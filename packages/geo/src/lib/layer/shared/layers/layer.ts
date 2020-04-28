import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  combineLatest
} from 'rxjs';
import { map, first } from 'rxjs/operators';

import olLayer from 'ol/layer/Layer';

import { AuthInterceptor } from '@igo2/auth';
import { SubjectStatus, ObjectUtils } from '@igo2/utils';

import { DataSource, Legend, WMSDataSource } from '../../../datasource';
import { IgoMap } from '../../../map/shared/map';
import { getResolutionFromScale } from '../../../map/shared/map.utils';

import { LayerOptions, LayersLink, ComputedLink } from './layer.interface';
import { TimeFilterableDataSourceOptions } from '../../../filter/shared/time-filter.interface';
import { MapService } from '../../../map/shared/map.service';

export abstract class Layer {

  public collapsed: boolean;
  public dataSource: DataSource;
  public legend: Legend[];
  public legendCollapsed: boolean = true;
  public firstLoadComponent: boolean = true;
  public map: IgoMap;
  public ol: olLayer;
  public status$: Subject<SubjectStatus>;

  private resolution$$: Subscription;

  get id(): string {
    return this.options.id || this.dataSource.id;
  }

  get title(): string {
    return this.options.title;
  }

  set title(title: string) {
    this.options.title = title;
  }

  get zIndex(): number {
    return this.ol.getZIndex();
  }

  set zIndex(zIndex: number) {
    this.ol.setZIndex(zIndex);
  }

  get baseLayer(): boolean {
    return this.options.baseLayer;
  }

  set baseLayer(baseLayer: boolean) {
    this.options.baseLayer = baseLayer;
  }

  get opacity(): number {
    return this.opacity$.value;
  }

  set opacity(opacity: number) {
    this.ol.setOpacity(opacity);
    this.opacity$.next(opacity);
  }

  set isInResolutionsRange(value: boolean) {
    this.isInResolutionsRange$.next(value);
  }
  get isInResolutionsRange(): boolean {
    return this.isInResolutionsRange$.value;
  }
  readonly isInResolutionsRange$: BehaviorSubject<
    boolean
  > = new BehaviorSubject(false);

  set maxResolution(value: number) {
    this.ol.setMaxResolution(value || Infinity);
    this.updateInResolutionsRange();
  }
  get maxResolution(): number {
    return this.ol.getMaxResolution();
  }

  set minResolution(value: number) {
    this.ol.setMinResolution(value || 0);
    this.updateInResolutionsRange();
  }
  get minResolution(): number {
    return this.ol.getMinResolution();
  }

  set visible(value: boolean) {
    this.ol.setVisible(value);
    this.visible$.next(value);
  }
  get visible(): boolean {
    return this.visible$.value;
  }
  readonly visible$: BehaviorSubject<boolean> = new BehaviorSubject(undefined);
  readonly opacity$: BehaviorSubject<number> = new BehaviorSubject(undefined);

  get displayed(): boolean {
    return this.visible && this.isInResolutionsRange;
  }
  readonly displayed$: Observable<boolean> = combineLatest([
    this.isInResolutionsRange$,
    this.visible$
  ]).pipe(map((bunch: [boolean, boolean]) => bunch[0] && bunch[1]));

  get showInLayerList(): boolean {
    return this.options.showInLayerList !== false;
  }

  constructor(
    public options: LayerOptions,
    protected authInterceptor?: AuthInterceptor,
    private mapService?: MapService
  ) {
    this.dataSource = options.source;

    this.ol = this.createOlLayer();
    if (options.zIndex !== undefined) {
      this.zIndex = options.zIndex;
    }

    if (options.baseLayer && options.visible === undefined) {
      options.visible = false;
    }

    this.maxResolution = options.maxResolution || getResolutionFromScale(Number(options.maxScaleDenom));
    this.minResolution = options.minResolution || getResolutionFromScale(Number(options.minScaleDenom));

    this.visible = options.visible === undefined ? true : options.visible;
    this.opacity = options.opacity === undefined ? 1 : options.opacity;

    if (
      options.legendOptions &&
      (options.legendOptions.url || options.legendOptions.html)
    ) {
      this.legend = this.dataSource.setLegend(options.legendOptions);
    }

    this.legendCollapsed = options.legendOptions
      ? options.legendOptions.collapsed
        ? options.legendOptions.collapsed
        : true
      : true;
    this.ol.set('_layer', this, true);
  }

  protected abstract createOlLayer(): olLayer;

  setMap(igoMap: IgoMap | undefined) {
    this.map = igoMap;

    this.unobserveResolution();
    if (igoMap !== undefined) {
      this.observeResolution();
      this.observePropertiesChange();
      this.map.status$
        .pipe(first())
        .subscribe(() => {
          this.ol.dispatchEvent({ type: 'change' });
          this.ol.dispatchEvent({ type: 'propertychange' });

          const computedLinks = [];
          this.map.layers
            .filter(layer => layer.options.linkedLayers && layer.options.linkedLayers.links)
            .map(layer => {
              const srcId = layer.options.linkedLayers.linkId;
              layer.options.linkedLayers.links.map(link => {
                const bidirectionnal = link.bidirectionnal !== undefined ? link.bidirectionnal : true;
                link.linkedIds.map(linkedId => {
                  computedLinks.push({ srcId, dstId: linkedId, properties: link.properties, bidirectionnal } as ComputedLink);
                });
              });
            });

          if (this.options.linkedLayers && this.options.linkedLayers.linkId) {
            const linkId = this.options.linkedLayers.linkId;
            this.options.linkedLayers.computedLinks =
              computedLinks.filter(computedLink => computedLink.srcId === linkId || computedLink.dstId === linkId);
          }
        });
    }
  }

  /**
   * Transfering properties between various layers.
   * @internal
   */
  private transferProperties(layerChange) {
    if (layerChange.target.getProperties().id === 'searchPointerSummaryId') {
      return;
    }
    const linkedLayers = layerChange.target.getProperties().linkedLayers as LayersLink;
    if (!linkedLayers) {
      return;
    }
    const computedLinks = linkedLayers.computedLinks;
    if (!computedLinks) {
      return;
    }
    const currentLinkedId = linkedLayers.linkId;
    computedLinks.map(computedLink => {
      const linkedProperties = computedLink.properties;
      const srcLayerId = computedLink.srcId;
      const dstLayerId = computedLink.dstId;
      const srcLayer = this.map.layers.find(layer => layer.options.linkedLayers && layer.options.linkedLayers.linkId === srcLayerId);
      const dstLayer = this.map.layers.find(layer => layer.options.linkedLayers && layer.options.linkedLayers.linkId === dstLayerId);
      if (!srcLayer || !dstLayer) {
        return;
      }
      if (!computedLink.bidirectionnal && currentLinkedId !== srcLayerId) {
        return;
      }
      if (layerChange.type === 'propertychange') {
        const key = layerChange.key;
        const newValue = layerChange.target.getProperties()[key];

        if (!linkedProperties || linkedProperties.indexOf(key) === -1) {
          return;
        }

        switch (computedLink.bidirectionnal) {
          case false:
            dstLayer[key] = newValue;
            break;
          case true:
          default:
            dstLayer[key] = newValue;
            srcLayer[key] = newValue;
            break;
        }

        if (key === 'visible') {
          this.visible = newValue;
        }
        if (key === 'opacity') {
          this.opacity = newValue;
        }
        // if (key === 'zIndex') {
        //   this.zIndex = newValue;
        // TODO
        // }
      }

      if (layerChange.type === 'change') {
        const layerChangeValues = layerChange.target.values_;

        const processOgcFilters = linkedProperties.indexOf('ogcFilters') !== -1;
        const processTimeFilter = linkedProperties.indexOf('timeFilter') !== -1;

        if (processOgcFilters) {
          const ogcFiltersToAssing = ObjectUtils.copyDeep(layerChangeValues.sourceOptions.ogcFilters);
          (dstLayer.options.source.options as any).ogcFilters = ogcFiltersToAssing;
          if (dstLayer.options.sourceOptions.type === 'wfs') {
            dstLayer.ol.getSource().clear();
          }
          if (dstLayer.options.sourceOptions.type === 'wms') {
            const appliedOgcFilter = layerChangeValues.sourceOptions.params.FILTER;
            (dstLayer.dataSource as WMSDataSource).ol.updateParams({ FILTER: appliedOgcFilter });
          }
          if (computedLink.bidirectionnal) {
            (srcLayer.options.source.options as any).ogcFilters = ogcFiltersToAssing;
            if (srcLayer.options.sourceOptions.type === 'wfs') {
              srcLayer.ol.getSource().clear();
            }
            if (srcLayer.options.sourceOptions.type === 'wms') {
              const appliedOgcFilter = layerChangeValues.sourceOptions.params.FILTER;
              (srcLayer.dataSource as WMSDataSource).ol.updateParams({ FILTER: appliedOgcFilter });
            }
          }
        }
        if (processTimeFilter) {
          const timeFilterToAssing = layerChangeValues.sourceOptions.timeFilter;
          if (dstLayer.options.sourceOptions.type === 'wms') {
            (dstLayer.options.source.options as TimeFilterableDataSourceOptions).timeFilter = timeFilterToAssing;
            (dstLayer.dataSource as WMSDataSource).ol.updateParams({ TIME: layerChangeValues.source.params_.TIME });
          }
          if (computedLink.bidirectionnal && srcLayer.options.sourceOptions.type === 'wms') {
            (srcLayer.options.source.options as TimeFilterableDataSourceOptions).timeFilter = timeFilterToAssing;
            (srcLayer.dataSource as WMSDataSource).ol.updateParams({ TIME: layerChangeValues.source.params_.TIME });
          }
        }
      }
    });
  }

  private observePropertiesChange() {
    if (!this.map) {
      return;
    }
    this.ol.on('propertychange', evt => {
      this.transferProperties(evt);
    });
    this.ol.on('change', evt => {
      this.transferProperties(evt);
    });
  }

  private observeResolution() {
    this.resolution$$ = this.map.viewController.resolution$.subscribe(() =>
      this.updateInResolutionsRange()
    );
  }

  private unobserveResolution() {
    if (this.resolution$$ !== undefined) {
      this.resolution$$.unsubscribe();
      this.resolution$$ = undefined;
    }
  }

  private updateInResolutionsRange() {
    if (this.map !== undefined) {
      const resolution = this.map.viewController.getResolution();
      const minResolution = this.minResolution;
      const maxResolution = this.maxResolution === undefined ? Infinity : this.maxResolution;
      this.isInResolutionsRange = resolution >= minResolution && resolution <= maxResolution;
    } else {
      this.isInResolutionsRange = false;
    }
  }
}
