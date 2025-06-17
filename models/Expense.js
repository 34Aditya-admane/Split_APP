// split_app_backend/models/Expense.js

const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  paid_by: {
    type: String,
    required: true,
  },
  split: [
    {
      name: {
        type: String,
        required: true,
      }
    }
  ],
}, {
  timestamps: true
});

module.exports = mongoose.model("Expense", expenseSchema);
