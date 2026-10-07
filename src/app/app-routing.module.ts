import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './composants/admin/admin.component';
import { DashboardComponent } from './composants/dashboard/dashboard.component';
import { PublierComponent } from './composants/publier/publier.component';
import { LoginComponent } from './composants/login/login.component';
import { GestionComponent } from './composants/gestion/gestion.component';
import { AdministrateursComponent } from './composants/administrateurs/administrateurs.component';
import { RequetesComponent } from './composants/requetes/requetes.component';
import { DetailsarticlesComponent } from './composants/detailsarticles/detailsarticles.component';
import { AudioComponent } from './composants/audio/audio.component';
import { DonationsComponent } from './composants/donations/donations.component';
import { DetailspaiementComponent } from './composants/detailspaiement/detailspaiement.component';
import { UtilisateursComponent } from './composants/utilisateurs/utilisateurs.component';
import { DetailsutilisateurComponent } from './composants/detailsutilisateur/detailsutilisateur.component';
import { superAdminGuard } from './guards/super-admin.guard';

const routes: Routes = [
  {path:'', redirectTo: 'login', pathMatch: 'full'},
  {path:'login', component: LoginComponent},
  {path:'admin', component: AdminComponent,
    children:[
      {path:'', redirectTo: 'dashboard', pathMatch:'full'},
      {path:'dashboard', component: DashboardComponent},
      {path:'publier', component: PublierComponent},
      {path:'gestion', component: GestionComponent},
      {path:'requetes-de-priere', component: RequetesComponent, canActivate: [superAdminGuard]},
      {path:'detailsarticles/:id', component: DetailsarticlesComponent},
      {path:'audios', component: AudioComponent},
      {path:'donations', component: DonationsComponent},
      {path:'donations/:id', component: DetailspaiementComponent},
      {path:'utilisateurs', component: UtilisateursComponent},
      {path:'utilisateurs/:id', component: DetailsutilisateurComponent},
      {path:'administrateurs', component: AdministrateursComponent, canActivate: [superAdminGuard]}
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
