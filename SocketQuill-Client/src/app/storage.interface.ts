/**
 * Created by AdityaChugh on 2017-05-03.
 */

export interface Store {
  get(key: string): any;
  set(key: string, value: any);
  exists(key: string): boolean;
  remove(key: string);
  canUse(): boolean;
}
