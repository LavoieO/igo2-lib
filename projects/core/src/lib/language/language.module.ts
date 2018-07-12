import { NgModule, ModuleWithProviders } from '@angular/core';
import {
  TranslateModule,
  MissingTranslationHandler
} from '@ngx-translate/core';

import { provideDefaultLanguageLoader } from './shared';
import { IgoMissingTranslationHandler } from './shared/missing-translation.guard';

@NgModule({
  imports: [
    TranslateModule.forRoot({
      missingTranslationHandler: {
        provide: MissingTranslationHandler,
        useClass: IgoMissingTranslationHandler
      }
    })
  ],
  declarations: [],
  exports: [TranslateModule],
  providers: [provideDefaultLanguageLoader()]
})
export class IgoLanguageModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: IgoLanguageModule,
      providers: []
    };
  }
}
