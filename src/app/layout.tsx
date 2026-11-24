import AdminAppShell from '@/components/admin-app-shell';
import type {Metadata} from 'next';
import './globals.css';
import './admin-theme.css';
import './club.css';
import './magazines.css';
import './editorial-management.css';
import './support.css';
import './calendar.css';
import './requests.css';
export const metadata:Metadata={title:'CDIR · Administración',description:'Gestión del club CDI Rozasbasket',icons:{icon:'/logo.png'},robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body><AdminAppShell>{children}</AdminAppShell></body></html>;}
