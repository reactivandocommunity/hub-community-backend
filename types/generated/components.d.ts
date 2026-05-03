import type { Schema, Struct } from '@strapi/strapi';

export interface FeedbackMealRating extends Struct.ComponentSchema {
  collectionName: 'components_feedback_meal_ratings';
  info: {
    description: 'Rating for a single meal slot during the event';
    displayName: 'Meal Rating';
  };
  attributes: {
    meal_slot: Schema.Attribute.Enumeration<
      [
        'sex_jantar',
        'sab_cafe',
        'sab_almoco',
        'sab_lanche',
        'sab_jantar',
        'dom_cafe',
        'dom_almoco',
        'dom_lanche',
      ]
    > &
      Schema.Attribute.Required;
    quality: Schema.Attribute.Enumeration<
      ['excelente', 'boa', 'regular', 'ruim']
    >;
    quantity: Schema.Attribute.Enumeration<
      ['suficiente', 'pouca', 'exagerada']
    >;
    variety: Schema.Attribute.Enumeration<
      ['excelente', 'boa', 'regular', 'ruim']
    >;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'feedback.meal-rating': FeedbackMealRating;
    }
  }
}
