-- Profile data belongs to an authorized account, independently of player data.
-- Images are private objects; the database stores the selected source and reference.
CREATE TABLE user_profiles (
 id uuid PRIMARY KEY,
 uid text NOT NULL UNIQUE REFERENCES members(uid),
 "googlePhotoUrl" text,
 "avatarPath" text,
 "avatarVersion" uuid,
 "avatarSource" text NOT NULL DEFAULT 'INITIALS'
   CHECK ("avatarSource" IN ('GOOGLE','UPLOAD','INITIALS')),
 "googleSyncedAt" timestamptz,
 "updatedAt" timestamptz NOT NULL,
 CHECK ("avatarSource" <> 'UPLOAD' OR ("avatarPath" IS NOT NULL AND "avatarVersion" IS NOT NULL)),
 CHECK ("avatarSource" <> 'GOOGLE' OR "googlePhotoUrl" IS NOT NULL)
);
