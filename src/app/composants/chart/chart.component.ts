import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.css'
})
export class ChartComponent implements AfterViewInit, OnDestroy {

  private chart?: Chart;

  ngAfterViewInit(): void {

    const canvas = document.getElementById(
      'genderChart'
    ) as HTMLCanvasElement;

    if (!canvas) return;

    this.chart = new Chart(canvas, {
      type: 'doughnut',

      data: {
        labels: ['Hommes', 'Femmes'],

        datasets: [
          {
            data: [100, 80],

            backgroundColor: [
              '#F97316',
              '#FDBA74'
            ],

            hoverBackgroundColor: [
              '#EA580C',
              '#FB923C'
            ],

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

                return ` ${value} utilisateurs`;
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

            const total = 100 + 80;

            const centerX =
              (chartArea.left + chartArea.right) / 2;

            const centerY =
              (chartArea.top + chartArea.bottom) / 2;

            ctx.save();

            // Total
            ctx.font = '700 28px Inter, sans-serif';
            ctx.fillStyle = '#111827';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.fillText(
              total.toString(),
              centerX,
              centerY - 8
            );

            // Label
            ctx.font = '500 12px Inter, sans-serif';
            ctx.fillStyle = '#9CA3AF';

            ctx.fillText(
              'Utilisateurs',
              centerX,
              centerY + 18
            );

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