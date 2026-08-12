import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailsarticlesComponent } from './detailsarticles.component';

describe('DetailsarticlesComponent', () => {
  let component: DetailsarticlesComponent;
  let fixture: ComponentFixture<DetailsarticlesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DetailsarticlesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetailsarticlesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
