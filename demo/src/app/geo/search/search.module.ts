import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
// import { HttpClientModule } from '@angular/common/http';

import {
  MatCardModule,
  MatButtonModule,
  MatIconModule,
  MatTooltipModule
} from '@angular/material';

import { IgoPanelModule } from '@igo2/common';
import {
  IgoMapModule,
  IgoSearchModule,
  provideIChercheSearchSource,
  provideDataSourceSearchSource,
  provideNominatimSearchSource
} from '@igo2/geo';

import { AppSearchComponent } from './search.component';
import { AppSearchRoutingModule } from './search-routing.module';

@NgModule({
  declarations: [AppSearchComponent],
  imports: [
    CommonModule,
    // HttpClientModule,
    AppSearchRoutingModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    IgoPanelModule,
    IgoMapModule,
    IgoSearchModule
  ],
  exports: [AppSearchComponent],
  providers: [
    provideIChercheSearchSource(),
    provideDataSourceSearchSource(),
    provideNominatimSearchSource()]
})
export class AppSearchModule {}
