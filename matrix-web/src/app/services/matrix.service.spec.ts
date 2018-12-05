import { TestBed, inject } from '@angular/core/testing';

import { MatrixService } from './matrix.service';

describe('MatrixService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MatrixService]
    });
  });

  it('should be created', inject([MatrixService], (service: MatrixService) => {
    expect(service).toBeTruthy();
  }));
});
