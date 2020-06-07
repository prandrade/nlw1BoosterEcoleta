import { Request, Response } from 'express';
import knex from '../database/connection';

class PointsController {
  async index(request: Request, response: Response) {
    const { city, uf, items } = request.query;

    const parsedItems = String(items)
      .split(',')
      .map(item => Number(item.trim()));

    const points = await knex('points')
      .join('point_items', 'points.id', '=', 'point_items.point_id')
      .whereIn('point_items.item_id', parsedItems)
      .where('city', String(city))
      .where('uf', String(uf))
      .distinct()
      .select('points.*');

    const serializedPoints = points.map(point => {
      return {
        ...point,
        imageUrl: `http://192.168.0.224:3333/uploads/${point.image}`,
      };
    });

    return response.json(serializedPoints);
  }

  async show(request: Request, response: Response) {
    const { id } = request.params;

    const point = await knex('points').where('id', id).first();

    if (!point) {
      return response.status(400).json({ message: 'Point not found' });
    }

    const serializedPoint = {
      ...point,
      imageUrl: `http://192.168.0.224:3333/uploads/${point.image}`,
    };

    const items = await knex('items')
      .join('point_items', 'items.id', '=', 'point_items.item_id')
      .where('point_items.point_id', id)
      .select('items.title');

    return response.json({ point: serializedPoint, items });
  }

  async create(request: Request, response: Response) {
    const {
      name,
      email,
      whatsapp,
      latitude,
      longitude,
      city,
      uf,
      items,
    } = request.body;

    if (name === undefined)
      return response.status(404).json('Nome do ponto de coleta não informado');

    if (email === undefined)
      return response
        .status(404)
        .json('E-mail do ponto de coleta não informado');

    if (whatsapp === undefined)
      return response
        .status(404)
        .json('WhatsApp do ponto de coleta não informado');

    const trx = await knex.transaction();

    const point = {
      image: request.file.filename,
      name,
      email,
      whatsapp: whatsapp.replace(/[^0-9]/g, ''),
      latitude,
      longitude,
      city,
      uf,
    };

    try {
      const insertedIds = await trx('points').insert(point);

      const point_id = insertedIds[0];

      const pointItems = items
        .split(',')
        .map((item: string) => Number(item.trim()))
        .map((item_id: number) => {
          return { item_id, point_id };
        });

      await trx('point_items').insert(pointItems);

      await trx.commit();

      return response.json({
        id: point_id,
        ...point,
      });
    } catch (error) {
      await trx.rollback();
      return response.status(400).json(error);
    }
  }
}

export default PointsController;
