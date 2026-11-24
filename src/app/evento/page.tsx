import {Suspense} from 'react';
import PublicEvent from '@/components/public-event';
export default function Page(){return <Suspense fallback={<div className='loading'>Cargando actividad…</div>}><PublicEvent/></Suspense>;}
