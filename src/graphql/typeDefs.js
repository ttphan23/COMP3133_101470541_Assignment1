const { gql } = require("apollo-server-express");

const typeDefs = gql`
  scalar JSON

  type User {
    _id: ID!
    username: String!
    email: String!
    created_at: String
    updated_at: String
  }

  type Employee {
    _id: ID!
    first_name: String!
    last_name: String!
    email: String!
    gender: String
    designation: String!
    salary: Float!
    date_of_joining: String!
    department: String!
    employee_photo: String
    created_at: String
    updated_at: String
  }

  type AuthPayload {
    success: Boolean!
    message: String!
    token: String
    user: User
  }

  type EmployeePayload {
    success: Boolean!
    message: String!
    employee: Employee
  }

  type EmployeesPayload {
    success: Boolean!
    message: String!
    employees: [Employee!]!
  }

  type DeletePayload {
    success: Boolean!
    message: String!
    deletedId: ID
  }

  type Query {
    login(input: JSON!): AuthPayload!
    getAllEmployees: EmployeesPayload!
    searchEmployeeByEid(eid: ID!): EmployeePayload!
    searchEmployeeByDesignationOrDepartment(input: JSON!): EmployeesPayload!
  }

  type Mutation {
    signup(input: JSON!): AuthPayload!
    addEmployee(input: JSON!): EmployeePayload!
    updateEmployeeByEid(eid: ID!, input: JSON!): EmployeePayload!
    deleteEmployeeByEid(eid: ID!): DeletePayload!
  }
`;

module.exports = { typeDefs };
