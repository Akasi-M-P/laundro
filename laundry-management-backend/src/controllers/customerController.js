const Customer = require('../models/Customer');
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');
const { logAudit } = require('../utils/logger');

/**
 * @desc    Get all customers for a shop (with pagination)
 * @route   GET /api/customers
 * @access  Employee/Owner
 */
const getCustomers = asyncHandler(async (req, res, next) => {
  const { search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  const user = req.user;

  // Build query
  const query = { shopId: user.shopId };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  // Execute query
  const [customers, total] = await Promise.all([
    Customer.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    Customer.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: customers,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Get single customer by ID
 * @route   GET /api/customers/:id
 * @access  Employee/Owner
 */
const getCustomer = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findOne({ 
    _id: req.params.id, 
    shopId: req.user.shopId 
  });

  if (!customer) {
    return next(new ErrorResponse('Customer not found', 404));
  }

  res.json({
    success: true,
    data: customer
  });
});

/**
 * @desc    Create a new customer
 * @route   POST /api/customers
 * @access  Employee/Owner
 */
const createCustomer = asyncHandler(async (req, res, next) => {
  const { name, phoneNumber } = req.body;
  const user = req.user;

  // Check if customer with same phone already exists in this shop
  const existingCustomer = await Customer.findOne({ 
    shopId: user.shopId, 
    phoneNumber 
  });

  if (existingCustomer) {
    return next(new ErrorResponse('Customer with this phone number already exists', 400));
  }

  const customer = await Customer.create({
    shopId: user.shopId,
    name,
    phoneNumber
  });

  await logAudit(user, 'CREATE_CUSTOMER', 'Customer', customer._id, { name, phoneNumber });

  res.status(201).json({
    success: true,
    data: customer
  });
});

/**
 * @desc    Update customer
 * @route   PUT /api/customers/:id
 * @access  Employee/Owner
 */
const updateCustomer = asyncHandler(async (req, res, next) => {
  const { name, phoneNumber } = req.body;
  const user = req.user;

  const customer = await Customer.findOne({ 
    _id: req.params.id, 
    shopId: user.shopId 
  });

  if (!customer) {
    return next(new ErrorResponse('Customer not found', 404));
  }

  // If phone number is being changed, check for duplicates
  if (phoneNumber && phoneNumber !== customer.phoneNumber) {
    const existingCustomer = await Customer.findOne({ 
      shopId: user.shopId, 
      phoneNumber,
      _id: { $ne: customer._id }
    });

    if (existingCustomer) {
      return next(new ErrorResponse('Customer with this phone number already exists', 400));
    }
  }

  if (name) customer.name = name;
  if (phoneNumber) customer.phoneNumber = phoneNumber;

  await customer.save();

  await logAudit(user, 'UPDATE_CUSTOMER', 'Customer', customer._id, { name, phoneNumber });

  res.json({
    success: true,
    data: customer
  });
});

module.exports = {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer
};
