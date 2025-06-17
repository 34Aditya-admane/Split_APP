// split_app_backend/index.js

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();  

const app = express();
app.use(cors());
app.use(express.json());


mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch(err => console.error("MongoDB connection error:", err));

const Expense = require("./models/Expense");

// Helper to calculate balances
const calculateBalances = async () => {
  const expenses = await Expense.find();
  const people = {};
  
  expenses.forEach(exp => {
    const amount = exp.amount;
    const paid_by = exp.paid_by;
    if (!people[paid_by]) people[paid_by] = 0;
    people[paid_by] += amount;

    const totalSplit = exp.split.length;
    const perHead = amount / totalSplit;

    exp.split.forEach(p => {
      if (!people[p.name]) people[p.name] = 0;
      people[p.name] -= perHead;
    });
  });
  return people;
};

// CRUD: Expenses
app.get("/expenses", async (req, res) => {
  const expenses = await Expense.find();
  res.json({ success: true, data: expenses });
});

app.post("/expenses", async (req, res) => {
  try {
    const { amount, description, paid_by, split } = req.body;
    if (!amount || amount <= 0) throw new Error("Invalid amount");
    if (!description) throw new Error("Missing description");
    if (!paid_by) throw new Error("Missing paid_by");

    const expense = new Expense({ amount, description, paid_by, split });
    await expense.save();
    res.status(201).json({ success: true, data: expense, message: "Expense added successfully" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.put("/expenses/:id", async (req, res) => {
  try {
    const updated = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) throw new Error("Expense not found");
    res.json({ success: true, data: updated, message: "Expense updated" });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

app.delete("/expenses/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Expense ID format" });
    }

    const deleted = await Expense.findByIdAndDelete(id);
    if (!deleted) throw new Error("Expense not found");

    res.json({ success: true, message: "Expense deleted" });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

// Settlement APIs
app.get("/people", async (req, res) => {
  const expenses = await Expense.find();
  const peopleSet = new Set();
  expenses.forEach(e => {
    peopleSet.add(e.paid_by);
    e.split.forEach(p => peopleSet.add(p.name));
  });
  res.json({ success: true, data: Array.from(peopleSet) });
});

app.get("/balances", async (req, res) => {
  const balances = await calculateBalances();
  res.json({ success: true, data: balances });
});

app.get("/settlements", async (req, res) => {
  const balances = await calculateBalances();
  const positive = [];
  const negative = [];

  Object.entries(balances).forEach(([name, balance]) => {
    if (balance > 0) positive.push({ name, amount: balance });
    else if (balance < 0) negative.push({ name, amount: -balance });
  });

  const settlements = [];

  positive.sort((a, b) => b.amount - a.amount);
  negative.sort((a, b) => b.amount - a.amount);

  let i = 0, j = 0;
  while (i < negative.length && j < positive.length) {
    const payer = negative[i];
    const receiver = positive[j];
    const minAmount = Math.min(payer.amount, receiver.amount);
    settlements.push({ from: payer.name, to: receiver.name, amount: minAmount });
    payer.amount -= minAmount;
    receiver.amount -= minAmount;
    if (payer.amount === 0) i++;
    if (receiver.amount === 0) j++;
  }

  res.json({ success: true, data: settlements });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
