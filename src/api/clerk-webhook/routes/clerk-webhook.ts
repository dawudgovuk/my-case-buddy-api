export default {
  routes: [
    {
      method: 'POST',
      path: '/clerk-webhook',
      handler: 'clerk-webhook.handleWebhook',
      config: {
        auth: false,
      },
    },
  ],
};
