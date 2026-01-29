const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema(
  {
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, index: true, trim: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], default: "Other" },
    designation: { type: String, required: true, trim: true },
    salary: { type: Number, required: true, min: 1000 },
    date_of_joining: { type: Date, required: true },
    department: { type: String, required: true, trim: true },
    employee_photo: { type: String, default: "" } // Cloudinary secure_url
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

module.exports = mongoose.model("Employee", EmployeeSchema);
