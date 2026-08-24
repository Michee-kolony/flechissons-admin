import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import Chart from 'chart.js/auto';

interface User {
  id: string;
  nom: string;
  email: string;
  sexe: string;
  // autres propriétés...
}

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.css'
})
export class ChartComponent implements AfterViewInit, OnDestroy {

  private chart?: Chart;
  private urlUser = "https://backend-flechissons.onrender.com/user";
  
  // Statistiques des utilisateurs
  hommes: number = 0;
  femmes: number = 0;
  nonPrecise: number = 0;
  total: number = 0;

  constructor(private http: HttpClient) {}

  ngAfterViewInit(): void {
    this.chargerUtilisateurs();
  }

  /**
   * Charge les utilisateurs depuis l'API
   */
  chargerUtilisateurs(): void {
    this.http.get<any>(this.urlUser).subscribe({
      next: (data) => {
        // Récupérer les utilisateurs depuis la réponse
        let utilisateurs: User[] = [];
        
        if (Array.isArray(data)) {
          utilisateurs = data;
        } else if (data && data.utilisateurs && Array.isArray(data.utilisateurs)) {
          utilisateurs = data.utilisateurs;
        } else if (data && data.users && Array.isArray(data.users)) {
          utilisateurs = data.users;
        }

        // Compter par sexe
        this.compterParSexe(utilisateurs);
        
        // Créer le graphique
        this.creerGraphique();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des utilisateurs:', err);
        // Utiliser des données par défaut en cas d'erreur
        this.hommes = 0;
        this.femmes = 0;
        this.nonPrecise = 0;
        this.total = 0;
        this.creerGraphique();
      }
    });
  }

  /**
   * Compte les utilisateurs par sexe
   */
  compterParSexe(utilisateurs: User[]): void {
    this.hommes = 0;
    this.femmes = 0;
    this.nonPrecise = 0;

    utilisateurs.forEach(user => {
      const sexe = user.sexe?.toLowerCase() || '';
      
      if (sexe === 'homme' || sexe === 'masculin' || sexe === 'male') {
        this.hommes++;
      } else if (sexe === 'femme' || sexe === 'feminin' || sexe === 'female') {
        this.femmes++;
      } else {
        this.nonPrecise++;
      }
    });

    this.total = utilisateurs.length;
  }

  /**
   * Crée le graphique avec les données
   */
  creerGraphique(): void {
    const canvas = document.getElementById('genderChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Détruire le graphique existant s'il y en a un
    if (this.chart) {
      this.chart.destroy();
    }

    // Préparer les données pour le graphique
    const labels: string[] = [];
    const data: number[] = [];
    const backgroundColors: string[] = [];
    const hoverBackgroundColors: string[] = [];

    // Ajouter les hommes si > 0 ou si c'est la seule catégorie
    if (this.hommes > 0 || (this.hommes === 0 && this.femmes === 0 && this.nonPrecise === 0)) {
      labels.push('Hommes');
      data.push(this.hommes > 0 ? this.hommes : 0);
      backgroundColors.push('#F97316');
      hoverBackgroundColors.push('#EA580C');
    }

    // Ajouter les femmes
    if (this.femmes > 0) {
      labels.push('Femmes');
      data.push(this.femmes);
      backgroundColors.push('#FDBA74');
      hoverBackgroundColors.push('#FB923C');
    }

    // Ajouter "Non précisé" si > 0
    if (this.nonPrecise > 0) {
      labels.push('Non précisé');
      data.push(this.nonPrecise);
      backgroundColors.push('#94A3B8');
      hoverBackgroundColors.push('#64748B');
    }

    // Si aucune donnée, afficher un message
    if (data.length === 0 || data.every(v => v === 0)) {
      labels.push('Aucune donnée');
      data.push(1);
      backgroundColors.push('#E5E7EB');
      hoverBackgroundColors.push('#D1D5DB');
    }

    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: backgroundColors,
            hoverBackgroundColor: hoverBackgroundColors,
            borderColor: '#ffffff',
            borderWidth: 5,
            hoverOffset: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 18,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                size: 13,
                weight: 500
              },
              color: '#4B5563'
            }
          },
          tooltip: {
            backgroundColor: '#111827',
            titleColor: '#ffffff',
            bodyColor: '#E5E7EB',
            padding: 12,
            cornerRadius: 10,
            displayColors: true,
            callbacks: {
              label: function(context) {
                const value = context.raw as number;
                const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return ` ${value} utilisateur${value > 1 ? 's' : ''} (${percentage}%)`;
              }
            }
          }
        }
      },
      plugins: [
        {
          id: 'centerText',
          beforeDraw(chart) {
            const { ctx, chartArea } = chart;
            if (!chartArea) return;

            const total = (chart.data.datasets[0].data as number[]).reduce((a, b) => a + b, 0);
            const centerX = (chartArea.left + chartArea.right) / 2;
            const centerY = (chartArea.top + chartArea.bottom) / 2;

            ctx.save();

            // Total
            ctx.font = '700 28px Inter, sans-serif';
            ctx.fillStyle = '#111827';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(total.toString(), centerX, centerY - 8);

            // Label
            ctx.font = '500 12px Inter, sans-serif';
            ctx.fillStyle = '#9CA3AF';
            ctx.fillText('Utilisateurs', centerX, centerY + 18);

            ctx.restore();
          }
        }
      ]
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}