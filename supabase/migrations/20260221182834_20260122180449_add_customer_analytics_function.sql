/*
  # Add Customer Analytics Function
  
  1. New Functions
    - `get_customer_analytics` - Returns customer performance metrics
      - Aggregates rentals, payments, and customer data
      - Calculates total revenue, total paid, balance, rental count
      - Returns risk indicator based on debt amount
  
  2. Returns
    - Customer ID, name, email, phone, company type
    - Total rental count
    - Total revenue (sum of rental amounts)
    - Total paid (sum of payments)
    - Balance (revenue - paid)
    - Risk level (high/medium/low)
  
  3. Performance
    - Uses aggregation for efficiency
    - Filters by company_id for multi-tenancy
*/

CREATE OR REPLACE FUNCTION get_customer_analytics(p_company_id uuid)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  company_type text,
  total_rentals bigint,
  total_revenue numeric,
  total_paid numeric,
  balance numeric,
  risk_level text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH customer_rentals AS (
    SELECT
      c.id as cust_id,
      c.company_title as cust_name,
      c.email as cust_email,
      c.phone as cust_phone,
      c.company_type as cust_company_type,
      COUNT(r.id) as rental_count,
      COALESCE(SUM(r.total_amount), 0) as revenue
    FROM customers c
    LEFT JOIN rentals r ON r.customer_id = c.id AND r.company_id = p_company_id
    WHERE c.company_id = p_company_id AND c.deleted_at IS NULL
    GROUP BY c.id, c.company_title, c.email, c.phone, c.company_type
  ),
  customer_payments AS (
    SELECT
      r.customer_id,
      COALESCE(SUM(p.amount), 0) as paid
    FROM rentals r
    LEFT JOIN payments p ON p.rental_id = r.id AND p.company_id = p_company_id
    WHERE r.company_id = p_company_id
    GROUP BY r.customer_id
  )
  SELECT
    cr.cust_id,
    cr.cust_name,
    cr.cust_email,
    cr.cust_phone,
    cr.cust_company_type,
    cr.rental_count,
    cr.revenue,
    COALESCE(cp.paid, 0) as total_paid,
    (cr.revenue - COALESCE(cp.paid, 0)) as balance,
    CASE
      WHEN (cr.revenue - COALESCE(cp.paid, 0)) > 20000 THEN 'high'
      WHEN (cr.revenue - COALESCE(cp.paid, 0)) > 0 THEN 'medium'
      ELSE 'low'
    END as risk_level
  FROM customer_rentals cr
  LEFT JOIN customer_payments cp ON cp.customer_id = cr.cust_id
  ORDER BY cr.revenue DESC;
END;
$$;