import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './composants/admin/admin.component';
import { DashboardComponent } from './composants/dashboard/dashboard.component';
import { PublierComponent } from './composants/publier/publier.component';
import { LoginComponent } from './composants/login/login.component';
import { GestionComponent } from './composants/gestion/gestion.component';
import { RequetesComponent } from './composants/requetes/requetes.component';
import { DetailsarticlesComponent } from './composants/detailsarticles/detailsarticles.component';

const routes: Routes = [
  {path:'', redirectTo: 'login', pathMatch: 'full'},
  {path:'login', component: LoginComponent},
  {path:'admin', component: AdminComponent,
    children:[
      {path:'', redirectTo: 'dashboard', pathMatch:'full'},
      {path:'dashboard', component: DashboardComponent},
      {path:'publier', component: PublierComponent},
      {path:'gestion', component: GestionComponent},
      {path:'requetes-de-priere', component: RequetesComponent},
      {path:'detailsarticles/:id', component: DetailsarticlesComponent}
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
