// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 5000;

mongoose.set("strictQuery", false);
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
};

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url}`);
  next();
});

app.use(bodyParser.json());
app.use(cors());

// Define the User schema
const UserSchema = new mongoose.Schema({
  username: String,
  email: {
    type: String,
    unique: true, // Ensure email uniqueness
  },
  password: String,
});

const User = mongoose.model("User", UserSchema);

// Define the Todo schema
const TodoSchema = new mongoose.Schema({
  todoTitle: String,
  description: String, // Add description field
  dueDate: Date, // Add dueDate field
  completed: Boolean,
  userId: String,
});

const Todo = mongoose.model("Todo", TodoSchema);

// User registration
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if the email already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const user = new User({ username, email, password: hashedPassword });
    const savedUser = await user.save();

    // Respond with the saved user object
    res.json(savedUser);
  } catch (err) {
    res.status(500).json({ error: "Error registering user" });
  }
});

// User login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log(req.body);
    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "Authentication failed" });
    }

    // Check the password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Authentication failed" });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user._id }, "iqGEPxO1vt");

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Error logging in" });
  }
});

// Middleware for verifying JWT tokens
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  jwt.verify(token, "iqGEPxO1vt", (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).json({ error: "Invalid token" });
    }

    req.userId = decoded.userId;
    next();
  });
};

// API routes for todos
app.get("/todos", verifyToken, async (req, res) => {
  try {
    const todos = await Todo.find({ userId: req.userId });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: "Error fetching todos" });
  }
});

app.post("/todos", verifyToken, async (req, res) => {
  try {
    const { todoTitle, description, dueDate, completed } = req.body;

    // Create a new todo associated with the authenticated user
    const todo = new Todo({
      todoTitle,
      description,
      dueDate,
      completed,
      userId: req.userId,
    });
    const savedTodo = await todo.save();

    res.json(savedTodo);
  } catch (err) {
    res.status(500).json({ error: "Error creating todo" });
  }
});

app.put("/todos/:id", verifyToken, async (req, res) => {
  try {
    const { todoTitle, description, dueDate, completed } = req.body;
    const todoId = req.params.id;

    // Find the todo by ID and user ID
    const todo = await Todo.findOne({ _id: todoId, userId: req.userId });

    if (!todo) {
      return res.status(404).json({ error: "Todo not found" });
    }

    // Update the todo
    todo.todoTitle = todoTitle || todo.todoTitle;
    todo.description = description || todo.description; // Update description
    todo.dueDate = dueDate || todo.dueDate; // Update dueDate
    todo.completed = completed !== undefined ? completed : todo.completed;

    const updatedTodo = await todo.save();

    res.json(updatedTodo);
  } catch (err) {
    res.status(500).json({ error: "Error updating todo" });
  }
});

app.delete("/todos/:id", verifyToken, async (req, res) => {
  try {
    const todoId = req.params.id;

    // Find the todo by ID and user ID
    const todo = await Todo.findOne({ _id: todoId, userId: req.userId });

    console.log(todo);

    if (!todo) {
      return res.status(404).json({ error: "Todo not found" });
    }

    // Delete the todo
    await Todo.deleteOne({ _id: todoId });

    res.json({ message: "Todo deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error deleting todo" });
  }
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log("Listening for requests");
  });
});
