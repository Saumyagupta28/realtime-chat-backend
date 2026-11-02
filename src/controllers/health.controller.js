function getHealth(req,res)
{
  res.status(200).json({
    success:"true",
    message:"chat backend is running"
  });
}


module.exports = {getHealth};