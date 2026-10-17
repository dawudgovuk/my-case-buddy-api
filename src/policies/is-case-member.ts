import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { isAdmin, type AppUser } from '../lib/domain/models';

const { UnauthorizedError, ForbiddenError } = errors;

interface CustomPolicyContext {
  state?: { user?: AppUser };
  params?: Record<string, string>;
}

const isCaseMemberPolicy = async (
  policyContext: CustomPolicyContext,
  _cfg: unknown,
  { strapi }: { strapi: Core.Strapi }
): Promise<boolean> => {
  const user = policyContext.state?.user;

  if (!user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Admin users bypass case-level restrictions
  if (isAdmin(user)) {
    return true;
  }

  const documentId = policyContext.params?.id || policyContext.params?.documentId;
  if (!documentId) {
    return true;
  }

  const isMember = await strapi.service('api::case.case').isUserCaseMember(documentId, user.id);
  if (isMember) {
    return true;
  }

  throw new ForbiddenError('You do not have permission to access or modify this case');
};

export default isCaseMemberPolicy;
