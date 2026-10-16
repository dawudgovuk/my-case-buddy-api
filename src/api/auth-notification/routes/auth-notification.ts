export default {
  routes: [
    {
      method: 'POST',
      path: '/auth-notification/send-registration-emails',
      handler: 'auth-notification.sendRegistrationEmails',
      config: {
        auth: false,
      },
    },
  ],
};
