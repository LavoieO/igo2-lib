import { Component } from '@angular/core';

import { LanguageService } from '@igo2/core';
import {
  IgoMap,
  DataSourceService,
  LayerService,
  FeatureStore,
  FeatureWithMeasure
} from '@igo2/geo';
import { InteractiveTourService } from 'packages/common/src/lib/interactive-tour/interactive-tour.service';

@Component({
  selector: 'app-measure',
  templateUrl: './measure.component.html',
  styleUrls: ['./measure.component.scss']
})
export class AppMeasureComponent {

  public map = new IgoMap({
    controls: {
      attribution: {
        collapsed: true
      },
      scaleLine: true
    }
  });

  public view = {
    center: [-73, 47.2],
    zoom: 6,
    projection: 'EPSG:3857'
  };

  public store = new FeatureStore<FeatureWithMeasure>([], {map: this.map});

  constructor(
    private languageService: LanguageService,
    private dataSourceService: DataSourceService,
    private layerService: LayerService,
    private interactiveTourService: InteractiveTourService
  ) {
    this.dataSourceService
      .createAsyncDataSource({
        type: 'osm'
      })
      .subscribe(dataSource => {
        this.map.addLayer(
          this.layerService.createLayer({
            title: 'OSM',
            source: dataSource
          })
        );
      });
  }

  startTour() {

    // this.interactiveTourService.configTourForTool('measurer');
    this.interactiveTourService.startTour('measurer');
  }

}
