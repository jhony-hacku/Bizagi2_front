import {
  Diagrama,
  DiagramaPool,
  TipoActividad,
  TipoEvento,
  TipoGateway,
} from '../../core/models/diagrama.model';

// Conversión del diagrama del backend a BPMN 2.0 XML con coordenadas (DI)

export const POOL_LEFT = 120;
export const POOL_LABEL = 30;
export const LANE_LABEL = 30;
export const CONTENT_X = POOL_LEFT + POOL_LABEL + LANE_LABEL;
export const LANE_HEIGHT = 150;
const POOL_GAP = 50;
const POOL_TOP = 40;
const BLACK_BOX_HEIGHT = 80;
const MIN_POOL_WIDTH = 900;
const AUTO_STEP = 150;

export const TASK_SIZE = { width: 100, height: 80 };
export const GATEWAY_SIZE = { width: 50, height: 50 };
export const EVENT_SIZE = { width: 36, height: 36 };

export type TipoNodo = 'actividad' | 'gateway' | 'evento';

export interface LaneBand {
  id: number;
  top: number;
  height: number;
}

export interface PoolBand {
  id: number;
  top: number;
  height: number;
  blackBox: boolean;
  lanes: LaneBand[];
}

export interface Layout {
  pools: PoolBand[];
}

export interface DiagramaBpmn {
  xml: string;
  layout: Layout;
}

// Identificadores BPMN de cada elemento del backend
export const idPool = (id: number) => `Pool_${id}`;
export const idLane = (id: number) => `Lane_${id}`;
export const idActividad = (id: number) => `Actividad_${id}`;
export const idGateway = (id: number) => `Gateway_${id}`;
export const idEvento = (id: number) => `Evento_${id}`;
export const idArco = (id: number) => `Arco_${id}`;
export const idMensaje = (id: number) => `Mensaje_${id}`;

const TAG_ACTIVIDAD: Record<TipoActividad, string> = {
  TAREA: 'task',
  USUARIO: 'userTask',
  MANUAL: 'manualTask',
  SERVICIO: 'serviceTask',
  ENVIO: 'sendTask',
};

const TAG_GATEWAY: Record<TipoGateway, string> = {
  EXCLUSIVA: 'exclusiveGateway',
  PARALELA: 'parallelGateway',
  INCLUSIVA: 'inclusiveGateway',
};

const TAG_EVENTO: Record<TipoEvento, { tag: string; mensaje: boolean }> = {
  INICIO: { tag: 'startEvent', mensaje: false },
  FIN: { tag: 'endEvent', mensaje: false },
  MENSAJE_LANZAMIENTO: { tag: 'intermediateThrowEvent', mensaje: true },
  MENSAJE_RECEPCION_INICIO: { tag: 'startEvent', mensaje: true },
  MENSAJE_RECEPCION_INTERMEDIO: { tag: 'intermediateCatchEvent', mensaje: true },
};

interface Caja {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NodoPosicionado {
  bpmnId: string;
  nodoId: number;
  caja: Caja;
  xml: () => string;
}

function esc(texto: string | null | undefined): string {
  return (texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sinPosicion(x: number, y: number): boolean {
  return !x && !y;
}

function esCajaNegra(pool: DiagramaPool): boolean {
  return (
    pool.tipoParticipante !== 'EMPRESA_PROPIETARIA' &&
    pool.lanes.length === 0 &&
    pool.actividades.length === 0 &&
    pool.gateways.length === 0 &&
    pool.eventos.length === 0
  );
}

function alturaPool(pool: DiagramaPool): number {
  return esCajaNegra(pool) ? BLACK_BOX_HEIGHT : Math.max(1, pool.lanes.length) * LANE_HEIGHT;
}

// Coordenada X libre a continuación de los nodos ya ubicados del pool
export function siguienteX(pool: DiagramaPool): number {
  const xs = [
    ...pool.actividades.map((a) => a.posicionX),
    ...pool.gateways.map((g) => g.posicionX),
    ...pool.eventos.map((e) => e.posicionX),
  ];
  return xs.length === 0 ? 40 : Math.round(Math.max(...xs) + 170);
}

export function construirBpmn(diagrama: Diagrama): DiagramaBpmn {
  const pools = diagrama.pools;
  const alturas = pools.map(alturaPool);

  // Ancho común para todos los pools
  let maxDerecha = 0;
  for (const pool of pools) {
    const total = pool.actividades.length + pool.gateways.length + pool.eventos.length;
    const xs = [
      ...pool.actividades.map((a) => a.posicionX + TASK_SIZE.width),
      ...pool.gateways.map((g) => g.posicionX + GATEWAY_SIZE.width),
      ...pool.eventos.map((e) => e.posicionX + EVENT_SIZE.width),
      total * AUTO_STEP,
    ];
    maxDerecha = Math.max(maxDerecha, ...xs);
  }
  const ancho = Math.max(MIN_POOL_WIDTH, CONTENT_X - POOL_LEFT + maxDerecha + 100);

  const layout: Layout = { pools: [] };
  const cajas = new Map<string, Caja>();
  const procesosXml: string[] = [];
  const formas: string[] = [];
  const conexiones: string[] = [];

  let top = POOL_TOP;
  pools.forEach((pool, indice) => {
    const altura = alturas[indice];
    const cajaNegra = esCajaNegra(pool);
    const bandas: LaneBand[] = pool.lanes.map((lane, i) => ({
      id: lane.id,
      top: top + i * LANE_HEIGHT,
      height: LANE_HEIGHT,
    }));
    layout.pools.push({ id: pool.id, top, height: altura, blackBox: cajaNegra, lanes: bandas });

    cajas.set(idPool(pool.id), { x: POOL_LEFT, y: top, width: ancho, height: altura });
    formas.push(
      `<bpmndi:BPMNShape id="${idPool(pool.id)}_di" bpmnElement="${idPool(pool.id)}" isHorizontal="true">` +
        `<dc:Bounds x="${POOL_LEFT}" y="${top}" width="${ancho}" height="${altura}"/></bpmndi:BPMNShape>`,
    );

    if (cajaNegra) {
      top += altura + POOL_GAP;
      return;
    }

    const posicionados: NodoPosicionado[] = [];
    let autoIndice = 0;
    const siguienteAuto = () => 30 + autoIndice++ * AUTO_STEP;

    for (const a of pool.actividades) {
      const laneIdx = Math.max(0, pool.lanes.findIndex((l) => l.id === a.laneId));
      const laneTop = top + laneIdx * LANE_HEIGHT;
      const auto = sinPosicion(a.posicionX, a.posicionY);
      const x = CONTENT_X + (auto ? siguienteAuto() : a.posicionX);
      const yRel = auto ? (LANE_HEIGHT - TASK_SIZE.height) / 2 : a.posicionY;
      const y = laneTop + Math.min(Math.max(0, yRel), LANE_HEIGHT - TASK_SIZE.height);
      const bpmnId = idActividad(a.id);
      posicionados.push({
        bpmnId,
        nodoId: a.id,
        caja: { x, y, ...TASK_SIZE },
        xml: () =>
          `<bpmn:${TAG_ACTIVIDAD[a.tipo]} id="${bpmnId}" name="${esc(a.nombre)}">` +
          (a.descripcion ? `<bpmn:documentation>${esc(a.descripcion)}</bpmn:documentation>` : '') +
          `</bpmn:${TAG_ACTIVIDAD[a.tipo]}>`,
      });
    }

    for (const g of pool.gateways) {
      const auto = sinPosicion(g.posicionX, g.posicionY);
      const x = CONTENT_X + (auto ? siguienteAuto() : g.posicionX);
      const yRel = auto ? (LANE_HEIGHT - GATEWAY_SIZE.height) / 2 : g.posicionY;
      const bpmnId = idGateway(g.id);
      posicionados.push({
        bpmnId,
        nodoId: g.id,
        caja: { x, y: top + Math.min(Math.max(0, yRel), altura - GATEWAY_SIZE.height), ...GATEWAY_SIZE },
        xml: () => `<bpmn:${TAG_GATEWAY[g.tipoGateway]} id="${bpmnId}" name="${esc(g.nombre)}"/>`,
      });
    }

    for (const e of pool.eventos) {
      const auto = sinPosicion(e.posicionX, e.posicionY);
      const x = CONTENT_X + (auto ? siguienteAuto() : e.posicionX);
      const yRel = auto ? (LANE_HEIGHT - EVENT_SIZE.height) / 2 : e.posicionY;
      const bpmnId = idEvento(e.id);
      const def = TAG_EVENTO[e.tipoEvento];
      posicionados.push({
        bpmnId,
        nodoId: e.id,
        caja: { x, y: top + Math.min(Math.max(0, yRel), altura - EVENT_SIZE.height), ...EVENT_SIZE },
        xml: () =>
          `<bpmn:${def.tag} id="${bpmnId}" name="${esc(e.nombre)}">` +
          (def.mensaje ? `<bpmn:messageEventDefinition id="${bpmnId}_def"/>` : '') +
          `</bpmn:${def.tag}>`,
      });
    }

    const refsPorLane = new Map<number, string[]>();
    for (const n of posicionados) {
      cajas.set(n.bpmnId, n.caja);
      const centroY = n.caja.y + n.caja.height / 2;
      const laneIdx = Math.min(
        Math.max(0, Math.floor((centroY - top) / LANE_HEIGHT)),
        Math.max(0, pool.lanes.length - 1),
      );
      const laneId = pool.lanes[laneIdx]?.id;
      if (laneId !== undefined) {
        refsPorLane.set(laneId, [...(refsPorLane.get(laneId) ?? []), n.bpmnId]);
      }
      formas.push(
        `<bpmndi:BPMNShape id="${n.bpmnId}_di" bpmnElement="${n.bpmnId}">` +
          `<dc:Bounds x="${n.caja.x}" y="${n.caja.y}" width="${n.caja.width}" height="${n.caja.height}"/>` +
          `</bpmndi:BPMNShape>`,
      );
    }

    const laneSet = pool.lanes.length
      ? `<bpmn:laneSet id="LaneSet_${pool.id}">` +
        pool.lanes
          .map(
            (l) =>
              `<bpmn:lane id="${idLane(l.id)}" name="${esc(l.nombre)}">` +
              (refsPorLane.get(l.id) ?? []).map((r) => `<bpmn:flowNodeRef>${r}</bpmn:flowNodeRef>`).join('') +
              `</bpmn:lane>`,
          )
          .join('') +
        `</bpmn:laneSet>`
      : '';

    pool.lanes.forEach((l, i) => {
      formas.push(
        `<bpmndi:BPMNShape id="${idLane(l.id)}_di" bpmnElement="${idLane(l.id)}" isHorizontal="true">` +
          `<dc:Bounds x="${POOL_LEFT + POOL_LABEL}" y="${top + i * LANE_HEIGHT}" width="${ancho - POOL_LABEL}" height="${LANE_HEIGHT}"/>` +
          `</bpmndi:BPMNShape>`,
      );
    });

    const idPorNodo = new Map<number, string>(posicionados.map((n) => [n.nodoId, n.bpmnId]));
    const flujos = pool.arcos
      .filter((a) => idPorNodo.has(a.origenId) && idPorNodo.has(a.destinoId))
      .map((a) => {
        const origen = idPorNodo.get(a.origenId)!;
        const destino = idPorNodo.get(a.destinoId)!;
        const nombre = a.etiqueta || a.condicion || '';
        const idArcoBpmn = idArco(a.id);
        conexiones.push(arista(idArcoBpmn, cajas, origen, destino));
        return (
          `<bpmn:sequenceFlow id="${idArcoBpmn}" sourceRef="${origen}" targetRef="${destino}"` +
          (nombre ? ` name="${esc(nombre)}"` : '') +
          (a.condicion
            ? `><bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${esc(a.condicion)}</bpmn:conditionExpression></bpmn:sequenceFlow>`
            : `/>`)
        );
      });

    procesosXml.push(
      `<bpmn:process id="Proceso_${pool.id}" isExecutable="false">` +
        laneSet +
        posicionados.map((n) => n.xml()).join('') +
        flujos.join('') +
        `</bpmn:process>`,
    );

    top += altura + POOL_GAP;
  });

  // Flujos de mensaje entre pools
  const idNodos = new Set<string>();
  for (const p of pools) {
    p.actividades.forEach((a) => idNodos.add(idActividad(a.id)));
    p.eventos.forEach((e) => idNodos.add(idEvento(e.id)));
    p.gateways.forEach((g) => idNodos.add(idGateway(g.id)));
  }
  const mensajesXml: string[] = [];
  for (const m of diagrama.mensajes) {
    const origen = [idActividad(m.origenId), idEvento(m.origenId), idGateway(m.origenId)].find((i) =>
      idNodos.has(i),
    );
    const destino = idPool(m.destinoPoolId);
    if (!origen || !cajas.has(destino)) continue;
    const idMsg = idMensaje(m.id);
    mensajesXml.push(`<bpmn:messageFlow id="${idMsg}" name="${esc(m.nombre)}" sourceRef="${origen}" targetRef="${destino}"/>`);
    conexiones.push(arista(idMsg, cajas, origen, destino));
  }

  const participantes = pools
    .map(
      (p) =>
        `<bpmn:participant id="${idPool(p.id)}" name="${esc(p.nombre)}"` +
        (esCajaNegra(p) ? '' : ` processRef="Proceso_${p.id}"`) +
        `/>`,
    )
    .join('');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ` +
    `xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" ` +
    `xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" ` +
    `xmlns:di="http://www.omg.org/spec/DD/20100524/DI" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `id="Definitions_${diagrama.proceso.id}" targetNamespace="http://bizagi2/proceso">` +
    `<bpmn:collaboration id="Collaboration_${diagrama.proceso.id}">${participantes}${mensajesXml.join('')}</bpmn:collaboration>` +
    procesosXml.join('') +
    `<bpmndi:BPMNDiagram id="Diagram_${diagrama.proceso.id}">` +
    `<bpmndi:BPMNPlane id="Plane_${diagrama.proceso.id}" bpmnElement="Collaboration_${diagrama.proceso.id}">` +
    formas.join('') +
    conexiones.join('') +
    `</bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>`;

  return { xml, layout };
}

function arista(id: string, cajas: Map<string, Caja>, origen: string, destino: string): string {
  const a = cajas.get(origen)!;
  const b = cajas.get(destino)!;
  const p1 = { x: Math.round(a.x + a.width / 2), y: Math.round(a.y + a.height / 2) };
  const p2 = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  return (
    `<bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">` +
    `<di:waypoint x="${p1.x}" y="${p1.y}"/><di:waypoint x="${p2.x}" y="${p2.y}"/>` +
    `</bpmndi:BPMNEdge>`
  );
}
