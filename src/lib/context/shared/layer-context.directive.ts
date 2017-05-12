import { Directive, Self, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';

import { IgoMap, MapBrowserComponent } from '../../map';
import { DataSourceService } from '../../datasource/shared';
import { LayerService } from '../../layer/shared';

import { ContextService } from './context.service';
import { DetailedContext, ContextLayer } from './context.interface';


@Directive({
  selector: '[igoLayerContext]'
})
export class LayerContextDirective implements OnInit, OnDestroy {

  private context$$: Subscription;

  get map(): IgoMap {
    return this.component.map;
  }

  constructor(@Self() private component: MapBrowserComponent,
              private contextService: ContextService,
              private dataSourceService: DataSourceService,
              private layerService: LayerService) {}

  ngOnInit() {
    this.context$$ = this.contextService.context$
      .filter(context => context !== undefined)
      .subscribe(context => this.handleContextChange(context));
  }

  ngOnDestroy() {
    this.context$$.unsubscribe();
  }

  private handleContextChange(context: DetailedContext) {
    if (context.layers === undefined) { return; }

    this.map.removeLayers();

    context.layers.forEach((contextLayer) => this.addLayerToMap(contextLayer));
  }

  private addLayerToMap(contextLayer: ContextLayer) {
    const sourceContext = contextLayer.source;
    const layerContext = Object.assign({}, contextLayer);
    delete layerContext.source;

    const dataSourceContext = Object.assign({}, layerContext, sourceContext);

    this.dataSourceService
      .createAsyncDataSource(dataSourceContext)
      .subscribe(dataSource =>  {
        this.map.addLayer(
          this.layerService.createLayer(dataSource, layerContext));
      });
  }

}