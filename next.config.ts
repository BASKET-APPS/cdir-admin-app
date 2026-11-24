import type {NextConfig} from 'next';
const config:NextConfig={poweredByHeader:false,output:process.env.CDIR_STANDALONE==='true'?'standalone':undefined,experimental:process.env.CDIR_BUILD_CPUS==='1'?{cpus:1}:undefined,distDir:process.env.CDIR_TEST_SERVER==='true'?'.next-club-test':'.next',devIndicators:false,images:{unoptimized:true},serverExternalPackages:['pg','firebase-admin','pdfjs-dist','@napi-rs/canvas']};
export default config;
