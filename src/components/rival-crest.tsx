'use client';
import {useState} from 'react';
import {Shield} from 'lucide-react';
import {findRivalClub,type RivalClub} from '@/domain/club-catalog';
export default function RivalCrest({name,club}:{name?:string;club?:RivalClub}){const c=club||findRivalClub(name||''),[failed,setFailed]=useState('');return c?.logoPath&&failed!==c.id?<img className='rival-crest' src={c.logoPath} alt={'Escudo de '+c.name} loading='lazy' onError={()=>setFailed(c.id)}/>:<span className='rival-crest rival-crest-fallback' title={c?'Escudo no disponible':name||'Club rival'}><Shield size={24}/></span>;}
