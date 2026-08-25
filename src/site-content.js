export const DEFAULT_CONTENT = {
  announcement_text: 'Free delivery on orders over 1,500 EGP',
  nav_home: 'Home',
  nav_collection: 'Collection',
  nav_categories: 'Categories',
  nav_policy: 'Policy',
  nav_search: 'Search',
  nav_cart: 'Cart',

  hero_eyebrow: 'EXCLUSIVE COLLECTION',
  hero_title: 'Timeless Elegance — Crafted for You',
  hero_description: 'Fine fragrances that leave a lasting impression. Made to be felt, remembered, desired.',
  hero_primary_button: 'Discover Collection',
  hero_secondary_button: 'Shop Now',
  hero_image_alt: 'Hawas Ice perfume by Elvira',

  quick_label: 'QUICK LOOK',
  quick_title: 'Discover the fragrances.',
  quick_text: 'A refined glimpse of Elvira. Open Collection to explore everything.',
  quick_view_all: 'View all →',

  categories_label: 'SHOP BY CATEGORY',
  categories_title: 'Find your signature.',
  categories_text: 'Choose male, female, or unisex fragrances and explore each world in its own collection.',
  categories_empty: 'Categories will appear here once added from Admin.',
  category_open: 'Open collection ↗',

  male_category_title: 'Male Fragrances',
  female_category_title: 'Female Fragrances',
  unisex_category_title: 'Unisex Fragrances',

  offers_label: 'NOW AT ELVIRA',
  offers_title: 'Selected fragrances, special prices.',
  offers_button: 'Shop offers →',

  collection_eyebrow: 'THE COLLECTION',
  collection_title: 'Find your signature.',
  collection_description: 'Browse every Elvira fragrance by gender, offer and price.',
  collection_all: 'All',
  collection_male: 'Male Fragrances',
  collection_female: 'Female Fragrances',
  collection_unisex: 'Unisex Fragrances',

  sort_label: 'Sort',
  sort_featured: 'Featured',
  sort_low: 'Price: low to high',
  sort_high: 'Price: high to low',
  sort_name: 'Name A–Z',

  category_eyebrow: 'ELVIRA CATEGORY',
  category_description: 'Explore the fragrances curated for this collection.',
  category_count_suffix: 'FRAGRANCES',
  category_view_all: 'View all →',
  category_empty: 'No fragrances in this category yet.',

  product_card_fallback: 'Your perfumes will appear here once added from Admin.',
  products_empty: 'Products will appear here once added from Admin.',

  cart_title: 'Your cart',
  cart_empty: 'Your cart is empty.',
  cart_total: 'Total',

  checkout_popup_title: 'Complete your order',
  checkout_add_to_cart: 'Add to cart',
  checkout_buy_now: 'Buy now',
  checkout_close: 'Close',
  checkout_title: 'Your information',
  checkout_name: 'Full name',
  checkout_whatsapp: 'WhatsApp number',
  checkout_phone: 'Phone number',
  checkout_address: 'Delivery address',
  checkout_city: 'City / area',
  checkout_region: 'Shipping region',
  checkout_quantity: 'Quantity',
  checkout_subtotal: 'Subtotal',
  checkout_offer: 'Offer discount',
  checkout_shipping: 'Shipping fee',
  checkout_total: 'Total',
  checkout_place_order: 'Place order',
  checkout_order_success: 'Order received. Thank you.',
  checkout_order_number: 'Order number',
  checkout_whatsapp_action: 'WhatsApp',
  checkout_call_action: 'Call us',
  checkout_before_price: 'Before offer',
  checkout_after_price: 'After offer',

  shipping_greater_cairo: 'Greater Cairo — EGP 80',
  shipping_nile_delta: 'Nile Delta — EGP 100',
  shipping_upper_egypt: 'Upper Egypt — EGP 120',
  shipping_remote: 'Remote areas — EGP 150',

  search_title: 'SEARCH ELVIRA',
  search_placeholder: 'Fragrances, notes, collections...',
  search_close_hint: 'Press Escape to close',

  product_not_found: 'Product not found',
  product_back: 'Back to collection →',
  product_available_suffix: 'available',
  product_sold_out: 'Sold out',

  policy_eyebrow: 'ELVIRA POLICY',
  policy_title: 'Our policy',
  policy_intro: 'We believe fragrance should feel personal, beautiful and easy to enjoy.',

  policy_delivery_title: 'Delivery & shipping',
  policy_delivery_text: 'Orders are prepared carefully and delivered to the address provided at checkout. Delivery timing and fees are confirmed before dispatch.',

  policy_returns_title: 'Returns & exchanges',
  policy_returns_text: 'Contact customer care promptly if your order arrives damaged or incorrect. Items should remain unused and in their original condition for eligible returns.',

  policy_care_title: 'Customer care',
  policy_care_text: 'For questions about fragrance, orders or availability, contact Elvira through the social links or customer-care channel provided by the store.',

  policy_privacy_title: 'Privacy',
  policy_privacy_text: 'Your information is used to process orders, provide support and manage your preferences. We do not sell personal information.',

  footer_instagram: 'Instagram',
  footer_facebook: 'Facebook',
  footer_tiktok: 'TikTok',
  support_whatsapp: 'WhatsApp support number',
  support_phone: 'Phone support number',
  footer_copyright: 'Elvira Fragrance. All rights reserved.'
};

export function contentFrom(settings) {
  return {
    ...DEFAULT_CONTENT,
    ...((settings && settings.content) || {})
  };
}
