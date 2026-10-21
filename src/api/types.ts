import type { components } from './schema';

type Schemas = components['schemas'];

export type Session = Schemas['SessionResponseDto'];
export type SessionUser = Schemas['SessionUserDto'];
export type Membership = Schemas['InstitutionMembershipDto'];
export type UserType = SessionUser['userType'];
export type MenuNode = Schemas['MyMenuNodeDto'];
export type MenuPermissions = Schemas['MenuNodePermissionsDto'];
export type Profile = Schemas['ProfileUserDto'];
export type PageMeta = Schemas['PaginationMetaDto'];
export type Institution = Schemas['InstitutionResponseDto'];
export type CreateInstitutionBody = Schemas['CreateInstitutionDto'];
export type UpdateInstitutionBody = Schemas['UpdateInstitutionDto'];
export type Campus = Schemas['CampusResponseDto'];
export type CreateCampusBody = Schemas['CreateCampusDto'];
export type UpdateCampusBody = Schemas['UpdateCampusDto'];
export type Avatar = Schemas['AvatarResponseDto'];
