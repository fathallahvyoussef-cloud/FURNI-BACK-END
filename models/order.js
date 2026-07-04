const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },

        quantity: {
          type: Number,
          required: true,
          default: 1
        },

        price: {
          type: Number,
          required: true
        },

      }
    ],
  
  total :
  {
    type: Number,
    required: true,
    default: 0
  },
date :
 {
    type : Date,
    required: true,
    default : Date.now()
},
adress : 
{
    type : String,
    required : true

},
phone :
{
    type : String,
    required : true

},
status : {
    type : String,
    required : true,
    default : 'pending'
}
 
});

module.exports = mongoose.model(
  'Order',
  orderSchema
);
