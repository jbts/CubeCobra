module.exports = {
  isUnlimited: {
    type: Boolean,
    default: false,
  },
  tags: [String],
  finish: {
    type: String,
    enum: ['Foil', 'Non-foil'],
  },
  colors: [{ type: String, enum: ['W', 'U', 'B', 'R', 'G', 'C'] }],
  status: {
    type: String,
    enum: ['Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'],
  },
  cmc: Number,
  cardID: String,
  type_line: String,
  imgUrl: String,
  imgBackUrl: String,
  notes: String,
  rating: Number,
  picks: {
    type: [[Number]],
    default: [],
  },
  passed: {
    type: Number,
    default: 0,
  },
  index: Number,
};
