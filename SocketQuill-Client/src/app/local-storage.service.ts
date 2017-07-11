import { Injectable } from '@angular/core';
import {Store} from "./storage.interface";

declare const window;

@Injectable()
export class LocalStorageService implements Store {

  prefix = 'realtime-quill.';
  localStorageRef: any;

  constructor() {
    this.localStorageRef = window.localStorage;
  }

  public set(key: string, value: any) {
    if (value == null) {
      this.remove(key);
    } else {
      this.localStorageRef.setItem(`${this.prefix}${key}`, value);
    }
  }

  public get(key: string): any {
    return this.localStorageRef.getItem(`${this.prefix}${key}`) || null;
  }

  public remove(key: string) {
    this.localStorageRef.clear(`${this.prefix}${key}`);
  }

  public exists(key: string): boolean {
    return typeof this.get(`${this.prefix}${key}`) !== 'undefined';
  }

  public canUse() {
    return typeof(this.localStorageRef) !== 'undefined';
  }
}
