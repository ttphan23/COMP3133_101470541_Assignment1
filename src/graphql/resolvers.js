const bcrypt = require("bcryptjs");
const validator = require("validator");
const User = require("../models/User");
const Employee = require("../models/Employee");
const { signToken, requireAuth } = require("../utils/auth");

function toISO(d) {
  if (!d) return null;
  try {
    return new Date(d).toISOString();
  } catch {
    return null;
  }
}

function normalizeEmployee(emp) {
  if (!emp) return null;
  return {
    ...emp.toObject(),
    created_at: toISO(emp.created_at),
    updated_at: toISO(emp.updated_at),
    date_of_joining: toISO(emp.date_of_joining)
  };
}

function normalizeUser(u) {
  if (!u) return null;
  const obj = u.toObject();
  delete obj.password;
  return {
    ...obj,
    created_at: toISO(obj.created_at),
    updated_at: toISO(obj.updated_at)
  };
}

function badRequest(message) {
  const e = new Error(message);
  e.code = "BAD_USER_INPUT";
  throw e;
}

async function uploadEmployeePhotoIfProvided(cloudinary, employee_photo) {
  // Accept JSON:
  // - empty => no upload
  // - URL => store directly
  // - base64/data-uri => upload to Cloudinary, store secure_url
  if (!employee_photo || typeof employee_photo !== "string") return "";

  const trimmed = employee_photo.trim();
  if (!trimmed) return "";

  if (validator.isURL(trimmed, { require_protocol: true })) {
    return trimmed;
  }

  // If base64 without prefix, try adding data uri prefix as jpg
  let data = trimmed;
  const looksBase64 = /^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 200;
  if (!trimmed.startsWith("data:") && looksBase64) {
    data = `data:image/jpeg;base64,${trimmed}`;
  }

  if (!data.startsWith("data:")) {
    // not URL, not base64 => just store as string path
    return trimmed;
  }

  if (!cloudinary) badRequest("Cloudinary is not configured.");

  const res = await cloudinary.uploader.upload(data, {
    folder: "comp3133_assignment1/employees",
    resource_type: "image"
  });

  return res.secure_url || "";
}

const resolvers = {
  Query: {
    async login(_, { input }) {
      const usernameOrEmail = (input?.username || input?.email || "").toString().trim();
      const password = (input?.password || "").toString();

      if (!usernameOrEmail) badRequest("username or email is required.");
      if (!password) badRequest("password is required.");

      const user = await User.findOne({
        $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }]
      });

      if (!user) badRequest("Invalid credentials.");

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) badRequest("Invalid credentials.");

      const token = signToken({ userId: user._id.toString(), username: user.username });

      return {
        success: true,
        message: "Login successful",
        token,
        user: normalizeUser(user)
      };
    },

    async getAllEmployees(_, __, context) {
      requireAuth(context);

      const employees = await Employee.find().sort({ created_at: -1 });
      return {
        success: true,
        message: "Employees fetched successfully",
        employees: employees.map(normalizeEmployee)
      };
    },

    async searchEmployeeByEid(_, { eid }, context) {
      requireAuth(context);

      const emp = await Employee.findById(eid);
      if (!emp) badRequest("Employee not found.");

      return {
        success: true,
        message: "Employee fetched successfully",
        employee: normalizeEmployee(emp)
      };
    },

    async searchEmployeeByDesignationOrDepartment(_, { input }, context) {
      requireAuth(context);

      const designation = (input?.designation || "").toString().trim();
      const department = (input?.department || "").toString().trim();

      if (!designation && !department) {
        badRequest("Provide designation or department.");
      }

      const q = {};
      if (designation) q.designation = new RegExp(`^${designation}$`, "i");
      if (department) q.department = new RegExp(`^${department}$`, "i");

      const employees = await Employee.find(q).sort({ created_at: -1 });

      return {
        success: true,
        message: "Employees fetched successfully",
        employees: employees.map(normalizeEmployee)
      };
    }
  },

  Mutation: {
    async signup(_, { input }) {
      const username = (input?.username || "").toString().trim();
      const email = (input?.email || "").toString().trim();
      const password = (input?.password || "").toString();

      if (!username) badRequest("username is required.");
      if (!email) badRequest("email is required.");
      if (!validator.isEmail(email)) badRequest("Invalid email.");
      if (!password || password.length < 6) badRequest("password must be at least 6 characters.");

      const existing = await User.findOne({ $or: [{ username }, { email }] });
      if (existing) badRequest("username or email already exists.");

      const hash = await bcrypt.hash(password, 10);
      const user = await User.create({ username, email, password: hash });

      const token = signToken({ userId: user._id.toString(), username: user.username });

      return {
        success: true,
        message: "Signup successful",
        token,
        user: normalizeUser(user)
      };
    },

    async addEmployee(_, { input }, context) {
      requireAuth(context);

      const first_name = (input?.first_name || "").toString().trim();
      const last_name = (input?.last_name || "").toString().trim();
      const email = (input?.email || "").toString().trim();
      const gender = (input?.gender || "Other").toString().trim();
      const designation = (input?.designation || "").toString().trim();
      const salary = Number(input?.salary);
      const date_of_joining = input?.date_of_joining;
      const department = (input?.department || "").toString().trim();

      if (!first_name) badRequest("first_name is required.");
      if (!last_name) badRequest("last_name is required.");
      if (!email) badRequest("email is required.");
      if (!validator.isEmail(email)) badRequest("Invalid email.");
      if (!designation) badRequest("designation is required.");
      if (!department) badRequest("department is required.");
      if (!Number.isFinite(salary) || salary < 1000) badRequest("salary must be >= 1000.");
      if (!date_of_joining) badRequest("date_of_joining is required.");

      const allowedGender = ["Male", "Female", "Other"];
      if (gender && !allowedGender.includes(gender)) badRequest("gender must be Male/Female/Other.");

      const exists = await Employee.findOne({ email });
      if (exists) badRequest("Employee email already exists.");

      const cloudinary = context.cloudinary;
      const employee_photo = await uploadEmployeePhotoIfProvided(cloudinary, input?.employee_photo);

      const emp = await Employee.create({
        first_name,
        last_name,
        email,
        gender,
        designation,
        salary,
        date_of_joining: new Date(date_of_joining),
        department,
        employee_photo
      });

      return {
        success: true,
        message: "Employee created successfully",
        employee: normalizeEmployee(emp)
      };
    },

    async updateEmployeeByEid(_, { eid, input }, context) {
      requireAuth(context);

      const update = {};

      if (input?.first_name !== undefined) {
        const v = (input.first_name || "").toString().trim();
        if (!v) badRequest("first_name cannot be empty.");
        update.first_name = v;
      }
      if (input?.last_name !== undefined) {
        const v = (input.last_name || "").toString().trim();
        if (!v) badRequest("last_name cannot be empty.");
        update.last_name = v;
      }
      if (input?.email !== undefined) {
        const v = (input.email || "").toString().trim();
        if (!v) badRequest("email cannot be empty.");
        if (!validator.isEmail(v)) badRequest("Invalid email.");
        update.email = v;
      }
      if (input?.gender !== undefined) {
        const v = (input.gender || "Other").toString().trim();
        const allowedGender = ["Male", "Female", "Other"];
        if (!allowedGender.includes(v)) badRequest("gender must be Male/Female/Other.");
        update.gender = v;
      }
      if (input?.designation !== undefined) {
        const v = (input.designation || "").toString().trim();
        if (!v) badRequest("designation cannot be empty.");
        update.designation = v;
      }
      if (input?.salary !== undefined) {
        const v = Number(input.salary);
        if (!Number.isFinite(v) || v < 1000) badRequest("salary must be >= 1000.");
        update.salary = v;
      }
      if (input?.date_of_joining !== undefined) {
        if (!input.date_of_joining) badRequest("date_of_joining cannot be empty.");
        update.date_of_joining = new Date(input.date_of_joining);
      }
      if (input?.department !== undefined) {
        const v = (input.department || "").toString().trim();
        if (!v) badRequest("department cannot be empty.");
        update.department = v;
      }

      if (input?.employee_photo !== undefined) {
        const cloudinary = context.cloudinary;
        update.employee_photo = await uploadEmployeePhotoIfProvided(cloudinary, input.employee_photo);
      }

      // email unique check if updating email
      if (update.email) {
        const other = await Employee.findOne({ email: update.email, _id: { $ne: eid } });
        if (other) badRequest("Employee email already exists.");
      }

      const emp = await Employee.findByIdAndUpdate(eid, update, { new: true });
      if (!emp) badRequest("Employee not found.");

      return {
        success: true,
        message: "Employee updated successfully",
        employee: normalizeEmployee(emp)
      };
    },

    async deleteEmployeeByEid(_, { eid }, context) {
      requireAuth(context);

      const emp = await Employee.findByIdAndDelete(eid);
      if (!emp) badRequest("Employee not found.");

      return {
        success: true,
        message: "Employee deleted successfully",
        deletedId: emp._id.toString()
      };
    }
  }
};

module.exports = { resolvers };
