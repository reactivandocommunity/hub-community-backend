export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: '*',
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      multipart: true,
      formidable: {
        maxFileSize: 250 * 1024 * 1024, // 250MB for video uploads
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
