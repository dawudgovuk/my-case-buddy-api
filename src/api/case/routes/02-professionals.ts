export default {
  routes: [
    {
      method: 'GET',
      path: '/professionals',
      handler: 'case.findProfessionals',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/cases/:id/request-peer-support',
      handler: 'case.requestPeerSupport',
      config: {
        policies: [],
      },
    },
  ],
};
