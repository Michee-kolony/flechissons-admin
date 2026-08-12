import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AdminComponent } from './composants/admin/admin.component';
import { DashboardComponent } from './composants/dashboard/dashboard.component';
import { PublierComponent } from './composants/publier/publier.component';
import { LoginComponent } from './composants/login/login.component';
import { ChartComponent } from './composants/chart/chart.component';
import { GestionComponent } from './composants/gestion/gestion.component';
import { RequetesComponent } from './composants/requetes/requetes.component';

import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DetailsarticlesComponent } from './composants/detailsarticles/detailsarticles.component';

@NgModule({
  declarations: [
    AppComponent,
    AdminComponent,
    DashboardComponent,
    PublierComponent,
    LoginComponent,
    ChartComponent,
    GestionComponent,
    RequetesComponent,
    DetailsarticlesComponent
  ],

  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule
  ],

  providers: [],

  bootstrap: [AppComponent]
})
export class AppModule {}