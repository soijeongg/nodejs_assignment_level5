import express from 'express';
import Joi from 'joi';
import { prisma } from '../utils/prisma/index.js';
import { ownerauth, customerauth } from '../middlewares/auth.middleware.js';

const router = express.Router();

//1, 2번 joi 필요시 작성
const orderSchema = Joi.object({
  menuId: Joi.number().required(),
  quantity: Joi.number().required(),
});
//3, 4 번 joi 필요시 작성
const statusSchemas = Joi.object({
  status: Joi.string().valid('PENDING', 'ACCEPTED', 'CANCEL').required(),
});

const OrderSchemas = Joi.object({
  orderId: Joi.number().integer().required(),
});
// 1번 라우터 작성
// 1. 메뉴 주문 API
//     - 메뉴 Id, 주문 갯수를 **request**에서 전달받기
//     - **메뉴 주문 API**는 하나의 메뉴만 주문 가능
//     - **주문 상태(OrderType)**는 **주문 대기(`PENDING`), 접수 완료(`ACCEPTED`), 취소(`CANCEL`)** 타입이 존재합니다.
//     - 메뉴 주문 시 기본 상태는 **주문 대기(`PENDING`)** 입니다.
//     - 로그인 토큰을 검사하여, **사용자(CUSTOMER)** 토큰일 경우에만 주문 가능
// POST, /api/orders
// 입력 예시
// {
//   "menuId": 1,
//   "quantity": 3
// }
// 출력 예시
// {
//     "message": "메뉴 주문에 성공하였습니다."
//   }
//에러 예시
// # 400 body 또는 params를 입력받지 못한 경우
// { message: '데이터 형식이 올바르지 않습니다.' }
// # 404 menuId에 해당하는 메뉴가 존재하지 않을 경우
// { message: 존재하지 않는 메뉴입니다. }
// # 401 로그인 되지 않은 상태인 경우
// { message: 로그인이 필요한 서비스입니다.}
// # 401 소비자(CUSTOMER) 토큰을 가지고 있지 않은 경우
// { message: 소비자만 사용할 수 있는 API입니다.}
router.post('/', customerauth, async (req, res) => {
  try {
    // req.body가 배열인 경우
    if (Array.isArray(req.body)) {
      req.body.forEach((item) => {
        const { error } = orderSchema.validate(item);
        if (error) {
          return res
            .status(400)
            .json({ message: '데이터 형식이 올바르지 않습니다.' });
        }
      });
    } else {
      // req.body가 단일 객체인 경우
      const { error } = orderSchema.validate(req.body);
      if (error) {
        return res
          .status(400)
          .json({ message: '데이터 형식이 올바르지 않습니다.' });
      }
      const { menuId, quantity } = req.body;
      const menu = await prisma.menus.findUnique({
        where: { menuId: +menuId },
      });
      if (!menu) {
        return res.status(404).json({ message: '존재하지 않는 메뉴입니다.' });
      }
      await prisma.orders.create({
        data: {
          menuId: +menuId,
          quantity: +quantity,
          userId: req.user.userId,
          totalPrice: menu.price * quantity,
        },
      });
      return res.status(200).json({ message: '메뉴 주문에 성공하였습니다.' });
    }
  } catch (error) {
    next(error);
  }
});

// 2번 라우터 작성
// 2. 사용자 주문 내역 조회 API
//     - 사용자가 주문한 메뉴의 이름, 가격, 갯수, 주문 상태, 주문 날짜, 총 주문 금액 조회하기
//     - 주문 날짜를 기준으로 내림차순(최신순) 정렬하기
//     - 로그인 토큰을 검사하여, **사용자(CUSTOMER)** 토큰일 경우에만 주문 내역 조회 가능
// GET, /api/orders/customer
// 입력 예시
// {}
// 출력 예시
// {
//     "data": [
//       {
//         "id":2,
//         "menu": {
//           "name": "된장찌개",
//           "price": 7500
//         },
//         "quantity": 7,
//         "status": "ACCEPTED",
//         "createdAt": "2023-10-20T10:29:48.239Z",
//         "totalPrice": 52500
//       },
//       {
//         "id":1,
//         "menu": {
//           "name": "김치찌개",
//           "price": 8000
//         },
//         "quantity": 3,
//         "status": "PENDING",
//         "createdAt": "2023-10-20T10:21:40.844Z",
//         "totalPrice": 24000
//       }
//     ]
//   }
// 에러 예시
// # 400 body 또는 params를 입력받지 못한 경우
// { message: '데이터 형식이 올바르지 않습니다.' }
// # 401 로그인 되지 않은 상태인 경우
// { message: 로그인이 필요한 서비스입니다.}
// # 401 소비자(CUSTOMER) 토큰을 가지고 있지 않은 경우
// { message: 소비자만 사용할 수 있는 API입니다.}
router.get('/customer', customerauth, async (req, res, next) => {
  try {
    const orders = await prisma.orders.findMany({
      where: {
        userId: req.user.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        menu: {
          select: {
            name: true,
            price: true,
          },
        },
        quantity: true,
        status: true,
        createdAt: true,
        totalPrice: true,
      },
    });
    const revisedOrders = orders.map((order) => ({
      id: order.orderId,
      ...order,
    }));
    return res.status(200).json({ data: revisedOrders });
  } catch (error) {
    next(error);
  }
});
// 3번 라우터 작성
//사장님 주문내역 조회 relation테이블의 정보를 가져와 보여주는 include 사용
router.get("/owner", ownerauth, async(req, res, next)=>{
    try {
      let findOrder = await prisma.Orders.findMany({
        select: {
          orderId: true,

          user: {
            select: {
              nickname: true,
            },
          },
          menu: {
            select: {
              name: true,
              price: true,
            },
          },
          quantity: true,
          status: true,
          createdAt: true,
          totalPrice: true,
        },
        orderBy: {
            createdAt: 'desc'
        },
      });
      res.status(200).json({ data: findOrder });
    } catch (error) {
      next(error);
    }
})

// 4번 라우터 작성
//주문 상태 변경 주문 아이디 주문 상태를 받고 토큰 사장일때만 
router.put("/:orderId/status", ownerauth, async(req,res, next)=>{
    try{
        let {orderId} = req.params
        let {status} = req.body
         const validationResult = OrderSchemas.validate({ orderId });
         if (validationResult.error) {
           return res
             .status(404)
             .json({ message: '데이터 형식이 올바르지 않습니다.' });
         }

         const validation  = statusSchemas.validate({status});
         if(validation.error){
            return res.status(404).json({message: "데이터 형식이 올바르지 않습니다"})
         }

         findOrder = await prisma.orders.findFirst({
            where: {orderId: +orderId}
         });
         if(!findOrder){
            return res.status(404).json({message: "존재하지 않는 주문내역입니다."})
         }
         let updateOne = await prisma.orders.update({
            data:{status},
            where:{orderId: orderId}
         })
         res.status(200).json({data:"주문 내역을 수정하였습니다."})
    }catch(error){
        next(error)
    }
})

export default router;
