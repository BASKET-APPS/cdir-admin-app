import {it,expect} from 'vitest';
import {demoState} from '@/domain/seed';
import {chooseAvatar,googlePhotoUrl,identityWithProfile,ownProfile,syncGoogleProfile} from '@/domain/profile';

it('solo admite imágenes HTTPS del proveedor Google',()=>{
 expect(googlePhotoUrl('https://lh3.googleusercontent.com/photo')).toBeTruthy();
 for(const url of ['http://lh3.googleusercontent.com/a','https://googleusercontent.com.evil.test/a','https://user:pass@lh3.googleusercontent.com/a','data:image/png;base64,abc'])expect(googlePhotoUrl(url)).toBeNull();
});
it('sincroniza Google y conserva la elección explícita del usuario',()=>{
 const s=demoState(),u=s.members[0];
 expect(syncGoogleProfile(s,u,'https://lh3.googleusercontent.com/a').avatarSource).toBe('GOOGLE');
 chooseAvatar(s,u,'INITIALS');syncGoogleProfile(s,u,'https://lh3.googleusercontent.com/b');
 expect(identityWithProfile(s,u).avatarUrl).toBeNull();
 const p=ownProfile(s,u);p.avatarPath='private/test.webp';p.avatarVersion=p.id;chooseAvatar(s,u,'UPLOAD');
 syncGoogleProfile(s,u,'https://lh3.googleusercontent.com/c');
 expect(identityWithProfile(s,u).avatarSource).toBe('UPLOAD');
 expect(JSON.stringify(identityWithProfile(s,u))).not.toContain('private/test.webp');
});
it('exige un miembro activo y una imagen existente para seleccionarla',()=>{
 const s=demoState(),u=s.members[0];
 expect(()=>chooseAvatar(s,u,'UPLOAD')).toThrow();
 expect(()=>chooseAvatar(s,u,'GOOGLE')).toThrow();
 expect(()=>ownProfile(s,{...u,uid:'otro-usuario'})).toThrow();
 u.active=false;expect(()=>ownProfile(s,u)).toThrow();
});
