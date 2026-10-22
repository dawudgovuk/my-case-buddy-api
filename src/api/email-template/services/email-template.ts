import { factories } from '@strapi/strapi';
import { TemplateService, type RenderedEmailResult } from '../../../lib/email/template-service';

export default factories.createCoreService('api::email-template.email-template', ({ strapi }) => {
  const templateService = new TemplateService(strapi);

  return {
    async render(
      templateKey: string,
      data: Record<string, unknown>,
      locale = 'en'
    ): Promise<RenderedEmailResult> {
      return templateService.renderTemplate(templateKey, data, locale);
    },

    async getTemplate(templateKey: string, locale = 'en') {
      return templateService.getTemplate(templateKey, locale);
    },
  };
});
