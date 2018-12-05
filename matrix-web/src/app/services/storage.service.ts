import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private data = {
    userData: null
  }
  constructor() { }

  get userData(){ return this.data.userData; }

  updateUserData(data){
    this.data.userData = data;
  }
}
