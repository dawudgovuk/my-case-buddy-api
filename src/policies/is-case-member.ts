import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { UnauthorizedError, ForbiddenError } = errors;

interface PolicyUser {
  id: number | string;
  role?: { type?: string };
}

interface CustomPolicyContext {
  state?: { user?: PolicyUser };
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
  if (user.role?.type === 'admin') {
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
