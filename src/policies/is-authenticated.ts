import { errors } from '@strapi/utils';

const { UnauthorizedError } = errors;

const isAuthenticatedPolicy = (policyContext: { state?: { user?: unknown } }): boolean => {
  if (policyContext.state?.user) {
    return true;
  }
  throw new UnauthorizedError('Authentication token is required');
};

export default isAuthenticatedPolicy;
