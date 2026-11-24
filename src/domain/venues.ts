import type {Venue} from './types';
export const clubVenueNames=['IES García Lorca','IES García Nieto','Colegio Europeo','Colegio Zola de Las Rozas','IES Carmen Conde'] as const;
export function currentVenues(venues:Venue[]){return venues.filter(v=>v.active!==false);}
export function venueLabel(v:Venue){return [v.name,v.space].filter(Boolean).join(' · ');}
export function venueKey(name:string){return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/[^a-z0-9]/g,'');}
