import { NgModule } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
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
import { AdministrateursComponent } from './composants/administrateurs/administrateurs.component';
import { RequetesChartComponent } from './composants/requetes-chart/requetes-chart.component';
import { DonationsComponent } from './composants/donations/donations.component';
import { DetailspaiementComponent } from './composants/detailspaiement/detailspaiement.component';
import { UtilisateursComponent } from './composants/utilisateurs/utilisateurs.component';
import { DetailsutilisateurComponent } from './composants/detailsutilisateur/detailsutilisateur.component';

import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DetailsarticlesComponent } from './composants/detailsarticles/detailsarticles.component';
import { AudioComponent } from './composants/audio/audio.component';
import { LivesComponent } from './composants/lives/lives.component';
import { EgliseComponent } from './composants/eglise/eglise.component';
import { EvenementsComponent } from './composants/evenements/evenements.component';

// Dates en français (pipe date avec la locale 'fr')
registerLocaleData(localeFr, 'fr');

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
    DetailsarticlesComponent,
    AudioComponent,
    AdministrateursComponent,
    RequetesChartComponent,
    DonationsComponent,
    DetailspaiementComponent,
    UtilisateursComponent,
    DetailsutilisateurComponent,
    LivesComponent,
    EgliseComponent,
    EvenementsComponent
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