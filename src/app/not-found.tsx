import Link from 'next/link';
export default function NotFound(){return <main className='error-page'><img src='/logo.png' alt='CDIR' width='90'/><h1>No encontramos esta sección.</h1><Link href='/'>Volver a administración →</Link></main>;}
