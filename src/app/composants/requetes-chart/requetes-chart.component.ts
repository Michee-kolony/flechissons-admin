import { Component, Input, OnChanges, AfterViewInit, OnDestroy, SimpleChanges } from '@angular/core';
import Chart from 'chart.js/auto';
import { Subscription, skip } from 'rxjs';
import { ThemeService, couleursGraphique } from '../../shared/theme.service';

interface RequeteDate {
  createdAt: string;
}

@Component({
  selector: 'app-requetes-chart',
  templateUrl: './requetes-chart.component.html',
  styleUrl: './requetes-chart.component.css'
})
export class RequetesChartComponent implements AfterViewInit, OnChanges, OnDestroy {

  @Input() requetes: RequeteDate[] = [];

  private chart?: Chart;
  private vueInitialisee = false;
  private abonnementTheme?: Subscription;

  private readonly moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  private readonly palette = ['#F97316', '#0EA5E9', '#A855F7', '#22C55E', '#EF4444', '#EAB308', '#64748B'];

  constructor(private themeService: ThemeService) {}

  ngAfterViewInit(): void {
    this.vueInitialisee = true;
    this.construireGraphique();

    // Redessine le graphique quand on bascule clair / sombre
    this.abonnementTheme = this.themeService.changements
      .pipe(skip(1))
      .subscribe(() => this.construireGraphique());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requetes'] && this.vueInitialisee) {
      this.construireGraphique();
    }
  }

  ngOnDestroy(): void {
    this.abonnementTheme?.unsubscribe();
    this.chart?.destroy();
  }

  get aucuneDonnee(): boolean {
    return !this.requetes || this.requetes.length === 0;
  }

  /**
   * Regroupe les requêtes par année puis par mois, et construit le graphique.
   */
  private construireGraphique(): void {
    const canvas = document.getElementById('requetesParMoisChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.chart) {
      this.chart.destroy();
    }

    const couleurs = couleursGraphique(this.themeService.estSombre);

    const parAnnee = new Map<number, number[]>();

    this.requetes.forEach(requete => {
      const date = new Date(requete.createdAt);
      if (isNaN(date.getTime())) return;

      const annee = date.getFullYear();
      const mois = date.getMonth();

      if (!parAnnee.has(annee)) {
        parAnnee.set(annee, new Array(12).fill(0));
      }
      parAnnee.get(annee)![mois]++;
    });

    const annees = Array.from(parAnnee.keys()).sort((a, b) => a - b);

    const datasets = annees.map((annee, index) => {
      const couleur = this.palette[index % this.palette.length];
      return {
        label: annee.toString(),
        data: parAnnee.get(annee)!,
        borderColor: couleur,
        backgroundColor: couleur + '1A',
        pointBackgroundColor: couleur,
        pointBorderColor: couleurs.separation,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
        borderWidth: 2.5
      };
    });

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: this.moisLabels,
        datasets: datasets.length > 0 ? datasets : [{
          label: 'Aucune donnée',
          data: new Array(12).fill(0),
          borderColor: couleurs.vide,
          backgroundColor: couleurs.vide + '33',
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        animation: {
          duration: 800,
          easing: 'easeOutQuart'
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              color: couleurs.texteDoux,
              font: { size: 11 }
            },
            grid: { color: couleurs.grille }
          },
          x: {
            ticks: {
              color: couleurs.texteDoux,
              font: { size: 11 }
            },
            grid: { display: false }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16,
              font: { size: 12, weight: 500 },
              color: couleurs.texte
            }
          },
          tooltip: {
            backgroundColor: couleurs.infobulleFond,
            borderColor: couleurs.infobulleBordure,
            borderWidth: 1,
            titleColor: '#ffffff',
            bodyColor: '#E5E7EB',
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                return ` ${context.dataset.label} : ${value} requête${value > 1 ? 's' : ''}`;
              }
            }
          }
        }
      }
    });
  }
}
