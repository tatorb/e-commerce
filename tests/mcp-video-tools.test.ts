import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { VIDEO_PROTOCOL } from '@/domain/video-edit';
import { createWorkerKey, verifyWorkerRequest } from '@/lib/image-worker';
import type { McpContext } from '@/lib/mcp/tool';
import { claimNextEdit, editHeartbeat, submitEditResult } from '@/lib/video-edits';

// El editor de videos desde Claude. Datos inventados.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { handleRpc, toolList } = await import('@/lib/mcp/server');

describe('herramientas del editor de videos en la lista', () => {
  it('ver y la cola solo leen; lo que pisa o descarta pide confirmación', () => {
    const tools = new Map(toolList().map((t) => [t.name, t.annotations]));
    expect(tools.get('get_videos_step')).toMatchObject({ readOnlyHint: true });
    expect(tools.get('get_video_queue')).toMatchObject({ readOnlyHint: true });
    for (const name of ['save_video_script', 'request_video_edit', 'review_video_edit', 'set_video_moments']) {
      expect(tools.get(name), name).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    }
    expect(tools.get('update_video_settings')).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  });

  it('las descripciones dicen que el guión no relata el video', () => {
    const tools = new Map(toolList().map((t) => [t.name, t.description]));
    expect(tools.get('save_video_script')).toContain('NO relata lo que se ve');
    expect(tools.get('get_videos_step')).toContain('no inventes nada');
  });
});

describe.skipIf(!url)('el editor de videos desde Claude', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const ctx: McpContext = { db, userId: 'u1', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
  let videoId = '';
  let stepId = '';
  let workerId = '';
  let accountId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE product_options, video_edits, video_scripts, video_editor_settings, video_account_settings, image_workers, publication_clips, product_videos, shoot_steps, shoot_protocols, drive_connections, channel_copies, publications, products, stores, channels, accounts, users CASCADE',
    );
    await db.user.create({ data: { id: 'u1', name: 'Persona', email: 'persona@example.com' } });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } });
    const product = await db.product.create({ data: { accountId, name: 'Camisa 384675', productType: 'Camisa de cilindro' } });
    await db.publication.create({ data: { productId: product.id, storeId: store.id, externalId: 'MLA1110001', title: 'Kit 4 Camisas' } });
    videoId = (await db.productVideo.create({ data: { productId: product.id, driveFileId: 'drive-1', name: 'DJI_0073_D.MP4', mimeType: 'video/mp4', origin: 'DRIVE', durationMs: 106_600, width: 3840, height: 2160 } })).id;
    const protocol = await db.shootProtocol.create({ data: { accountId, name: 'Unboxing' } });
    stepId = (await db.shootStep.create({ data: { protocolId: protocol.id, title: 'Unboxing cenital', kind: 'VIDEO', explanation: 'Cámara arriba.' } })).id;
    const key = await createWorkerKey(db, 'u1');
    workerId = (await verifyWorkerRequest(db, `Bearer ${key}`))!.workerId;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    const r = (await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, ctx)) as {
      result: { content: { text: string }[]; isError?: boolean };
    };
    const text = r.result.content[0].text;
    return { text, isError: r.result.isError === true, data: r.result.isError ? null : JSON.parse(text) };
  }

  const PLAN = {
    imagen: { cuartos: 1, enderezado: 0, zoom: 1, centro_x: 0.5, centro_y: 0.5, rojo: 1.1, verde: 1.05, azul: 1, contraste: 1, saturacion: 1 },
    tramos: [
      { inicio: 0, fin: 8, velocidad: 1, nombre: 'La caja', importancia: 'IMPORTANTE' as const },
      { inicio: 8, fin: 106.6, velocidad: 3.4, nombre: 'Las piezas', importancia: 'REPETIDO' as const },
    ],
    cierre: 2,
  };

  /** La Mac toma la edición y entrega el clip. */
  async function macDelivers(avisos: string[] = []) {
    const { editId } = (await claimNextEdit(db, workerId))!;
    await submitEditResult(
      db,
      workerId,
      {
        protocolo: VIDEO_PROTOCOL,
        id: editId,
        turno: 1,
        ok: true,
        plan: PLAN,
        medidas: {},
        propuesta: { razon: 'Girado un cuarto.', origen: 'claude', avisos: [], uso: { costo_usd: 0.02 } },
        clip: { ancho: 1080, alto: 1920, segundos: 39, bytes: 40_000_000 },
        guion: [{ inicio: 0.4, fin: 4.2, texto: 'Camisas para Fiat uno punto siete diésel.' }],
        sonido: { voz: true, musica: true, subtitulos: true, costo_usd: null },
        avisos,
        segundos: 200,
      },
      { collect: async () => ({ fileId: `clip-${editId}`, name: 'DJI_0073_D · editado.mp4', mimeType: 'video/mp4', size: BigInt(40_000_000), webViewLink: null, createdAt: new Date() }) },
    );
    return editId;
  }

  it('muestra el paso Videos: los videos, sin guión todavía, los ajustes, la Mac y los pasos del protocolo', async () => {
    const r = await call('get_videos_step', { publicacion: 'MLA1110001' });
    expect(r.data.videos).toEqual([expect.objectContaining({ video: videoId, nombre: 'DJI_0073_D.MP4', duracion: '1 min 47 s', tamano: '3840 × 2160', paso_con_que_se_edita: null, es_clip_de_esta_publicacion: false })]);
    expect(r.data.videos[0].edicion).toBeUndefined();
    expect(r.data.guion_del_clip).toBeNull();
    expect(r.data.para_escribir_el_guion).toMatchObject({ segundos_del_clip: 45, lo_mas_que_acepta_el_canal_en_segundos: 60 });
    expect(r.data.para_escribir_el_guion.palabras_que_entran).toBeGreaterThan(80);
    expect(r.data.como_se_editan_los_videos_de_la_cuenta).toMatchObject({ voz_en_off: false, musica: false, subtitulos: false, color_de_los_subtitulos: '#FFE633', claude_escribe_el_guion_solo: false });
    expect(r.data.mac_del_estudio).toEqual({ cuando_edita: 'Apagado: la Mac no edita videos.', conectada: true, tiene_llave: true });
    expect(r.data.pasos_de_video_de_los_protocolos).toEqual([
      { paso: stepId, nombre: 'Unboxing: Unboxing cenital', tipo_de_producto_del_protocolo: null, se_usa_para_los_videos_copiados_al_drive: true, indicaciones_para_el_editor: null, momentos: [] },
    ]);
    // El protocolo todavía no es de ningún tipo: el video del Drive no usa protocolo.
    expect(r.data.videos[0].por_que_ese_paso).toContain('no tiene protocolo');
    // Se le pone el tipo del producto y el video pasa a editarse con su paso de video.
    await db.productOption.create({ data: { accountId, kind: 'TYPE', name: 'Camisa de cilindro' } });
    const typed = await call('set_protocol_product_type', { protocolo: 'unboxing', tipo_de_producto: 'camisa de cilindro' });
    expect(typed.data.protocolos).toEqual([expect.objectContaining({ nombre: 'Unboxing', tipo_de_producto: 'Camisa de cilindro', pasos_de_video: 1 })]);
    const after = await call('get_videos_step', { publicacion: 'MLA1110001' });
    expect(after.data.videos[0]).toMatchObject({ paso_con_que_se_edita: stepId, por_que_ese_paso: 'Es el paso de video del protocolo de su tipo de producto.' });
    // Pedir la edición sin protocolo manda sobre eso.
    await call('request_video_edit', { publicacion: 'MLA1110001', video: videoId, paso: null });
    expect((await call('get_videos_step', { publicacion: 'MLA1110001' })).data.videos[0]).toMatchObject({ paso_con_que_se_edita: null, por_que_ese_paso: 'Lo eligió una persona.' });
    expect((await call('set_protocol_product_type', { protocolo: 'unboxing', tipo_de_producto: 'Bujías' })).text).toContain('no está en los tipos');
    expect(r.data.link_app).toMatch(/\?paso=videos$/);
  });

  it('carga los momentos del protocolo y los ajustes de la cuenta, con el modo de la Mac', async () => {
    const moments = [
      { texto: 'Mostrar la caja y la etiqueta', importancia: 'IMPORTANTE' },
      { texto: 'Sacar las demás piezas', importancia: 'REPETIDO' },
    ];
    const m = await call('set_video_moments', { paso: stepId, momentos: moments, indicaciones_para_el_editor: 'Que se lea la etiqueta.' });
    expect(m.data).toMatchObject({ paso: stepId, momentos: moments, indicaciones_para_el_editor: 'Que se lea la etiqueta.' });
    // Lo demás del paso queda como estaba.
    expect(await db.shootStep.findUniqueOrThrow({ where: { id: stepId } })).toMatchObject({ title: 'Unboxing cenital', kind: 'VIDEO', explanation: 'Cámara arriba.' });
    expect((await call('set_video_moments', { paso: 'otro', momentos: [] })).text).toContain('No hay un paso de video «otro»');

    const bad = await call('update_video_settings', { voz_en_off: true });
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain('ID de la voz');
    const s = await call('update_video_settings', {
      segundos_del_clip: 40,
      voz_en_off: true,
      voz_de_elevenlabs: 'voz1',
      musica: true,
      subtitulos: true,
      color_de_los_subtitulos: '#6fa82c',
      modo_de_la_mac: { modo: 'SCHEDULE', desde: '22:00', hasta: '7:00', solo_enchufada: true },
    });
    expect(s.data.como_se_editan_los_videos_de_la_cuenta).toMatchObject({ segundos_del_clip: 40, voz_en_off: true, voz_de_elevenlabs: 'voz1', subtitulos: true, color_de_los_subtitulos: '#6FA82C' });
    expect(s.data.como_se_editan_los_videos_de_la_cuenta).not.toHaveProperty('paso_para_los_videos_copiados_al_drive');
    expect(s.data.mac_del_estudio.cuando_edita).toBe('Con horario: edita de 22:00 a 07:00, solo enchufada.');
    // Lo que no se manda queda como está.
    const again = await call('update_video_settings', { musica: false });
    expect(again.data.como_se_editan_los_videos_de_la_cuenta).toMatchObject({ segundos_del_clip: 40, voz_en_off: true, musica: false });
    const step = await call('get_videos_step', { publicacion: 'MLA1110001' });
    expect(step.data.pasos_de_video_de_los_protocolos[0].momentos).toEqual(moments);
  });

  it('quien no es administrador no cambia cuándo edita la Mac', async () => {
    const before = ctx.access;
    ctx.access = { isAdmin: false, permissions: { protocolos: 'write' } as never, accountIds: [accountId] };
    try {
      const r = await call('update_video_settings', { segundos_del_clip: 30, modo_de_la_mac: { modo: 'ON' } });
      expect(r.isError).toBe(true);
      expect(r.text).toContain('solo un administrador');
      expect(await db.videoEditorSettings.count()).toBe(0);
    } finally {
      ctx.access = before;
    }
  });

  it('guarda el guión del clip, avisa si es largo o si la voz está apagada, y lo borra', async () => {
    const frases = ['Camisas de cilindro para motor Fiat uno punto siete diésel.', '  ', 'Sirven para Uno, Duna y Fiorino.'];
    const r = await call('save_video_script', { publicacion: 'MLA1110001', frases });
    expect(r.data.guion_del_clip).toEqual({ frases: [frases[0], frases[2]], palabras: 16, segundos: expect.any(Number) });
    expect(r.data.voz_apagada).toContain('update_video_settings');
    const step = await call('get_videos_step', { publicacion: 'MLA1110001' });
    expect(step.data.guion_del_clip).toMatchObject({ frases: [frases[0], frases[2]], palabras: 16, lo_escribio: 'Claude, sin corregir' });

    const long = Array.from({ length: 10 }, () => 'Una frase larga de unas quince palabras que no termina nunca y sigue y sigue.');
    const tooLong = await call('save_video_script', { publicacion: 'MLA1110001', frases: long });
    expect(tooLong.isError).toBe(true);
    expect(tooLong.text).toContain('el clip puede durar hasta 60');

    await call('update_video_settings', { segundos_del_clip: 10, voz_en_off: true, voz_de_elevenlabs: 'voz1' });
    const warned = await call('save_video_script', { publicacion: 'MLA1110001', frases: long.slice(0, 3) });
    expect(warned.data.aviso).toContain('el editor lo va a hacer más largo');
    expect(warned.data.voz_apagada).toBeUndefined();

    const cleared = await call('save_video_script', { publicacion: 'MLA1110001', frases: [] });
    expect(cleared.data.guion_del_clip).toBeNull();
    expect(await db.videoScript.count()).toBe(0);
  });

  it('pide la edición, muestra el avance y la cola, aprueba el clip, lo rehace con un plan y lo descarta', async () => {
    await call('update_video_settings', { voz_en_off: true, voz_de_elevenlabs: 'voz1' });
    await call('save_video_script', { publicacion: 'MLA1110001', frases: ['Camisas para Fiat uno punto siete diésel.'] });
    const asked = await call('request_video_edit', { publicacion: 'MLA1110001', video: videoId, segundos: 40, indicacion: 'Más lento al final.', paso: stepId });
    expect(asked.data.edicion).toMatchObject({ estado: 'en cola', segundos_pedidos: 40, indicacion: 'Más lento al final.', pedida_por: 'Persona' });
    expect(asked.data.mac_del_estudio.cuando_edita).toBe('Apagado: la Mac no edita videos.');
    expect((await db.productVideo.findUniqueOrThrow({ where: { id: videoId } })).shootStepId).toBe(stepId);
    // El guión viaja como estaba al pedirla.
    expect((await db.videoEdit.findFirstOrThrow()).requestedScript).toEqual(['Camisas para Fiat uno punto siete diésel.']);
    // Pedirla dos veces no hace nada.
    expect((await call('request_video_edit', { publicacion: 'MLA1110001', video: videoId })).data.aviso).toContain('ya está en la cola');
    expect(await db.videoEdit.count()).toBe(1);

    // La Mac la toma y cuenta en qué anda.
    const { editId } = (await claimNextEdit(db, workerId))!;
    await editHeartbeat(db, workerId, editId, 1, new Date(), { etapa: 'Exportando el clip', porcentaje: 42 });
    const queue = await call('get_video_queue');
    expect(queue.data.cola).toEqual([expect.objectContaining({ orden: 1, cuenta: 'Cuenta de prueba', producto: 'Camisa 384675', video: 'DJI_0073_D.MP4', estado: 'la Mac lo está editando', etapa: 'Exportando el clip', porcentaje: 42 })]);
    expect((await call('get_videos_step', { publicacion: 'MLA1110001' })).data.videos[0].edicion.avance).toEqual({ etapa: 'Exportando el clip', porcentaje: 42 });
    await db.videoEdit.update({ where: { id: editId }, data: { status: 'QUEUED', workerId: null, lease: 0, attempts: 0 } });

    // Entrega el clip: se ve cómo se editó y lo que dice la voz.
    await macDelivers(['La cámara fue cambiando la luz sola.']);
    const ready = await call('get_videos_step', { publicacion: 'MLA1110001' });
    const original = ready.data.videos.find((v: { video: string }) => v.video === videoId);
    expect(original.edicion).toMatchObject({
      estado: 'clip listo, espera la aprobación',
      explicacion: 'Girado un cuarto.',
      avisos: ['La cámara fue cambiando la luz sola.'],
      sonido: { voz: true, musica: true, subtitulos: true },
      lo_que_dice_la_voz: [{ segundo: 0.4, texto: 'Camisas para Fiat uno punto siete diésel.' }],
      costo_de_claude_usd: 0.02,
    });
    expect(original.edicion.plan.tramos[1]).toMatchObject({ desde: 8, hasta: 106.6, importancia: 'REPETIDO', en_palabras: '3,4 veces más rápido' });
    const clip = ready.data.videos.find((v: { clip_editado_de?: string }) => v.clip_editado_de);
    expect(clip).toMatchObject({ clip_editado_de: 'DJI_0073_D.MP4', aprobado: false, video: original.edicion.clip });
    expect((await call('get_video_queue')).data.cola).toEqual([]);

    // Rehacerlo con otros cortes: el clip anterior se descarta y la edición nueva lleva el plan tal cual.
    const plan = { ...PLAN, tramos: [PLAN.tramos[0], { ...PLAN.tramos[1], velocidad: 5 }] };
    const redone = await call('request_video_edit', { publicacion: 'MLA1110001', video: videoId, plan });
    expect(redone.data.clip_anterior).toContain('papelera');
    expect(redone.data.edicion).toMatchObject({ estado: 'en cola' });
    expect(redone.data.edicion.plan.tramos[1].velocidad).toBe(5);
    expect((await db.productVideo.findUniqueOrThrow({ where: { id: clip.video } })).goneAt).not.toBeNull();

    // Se aprueba el nuevo, y ya no se puede aprobar ni descartar otra vez.
    await macDelivers();
    const approved = await call('review_video_edit', { publicacion: 'MLA1110001', video: videoId, decision: 'aprobar' });
    expect(approved.data).toMatchObject({ estado: 'clip aprobado' });
    expect(approved.data.siguiente).toContain('set_publication_media');
    expect((await call('review_video_edit', { publicacion: 'MLA1110001', video: videoId, decision: 'descartar' })).text).toContain('ya está aprobado');

    // El clip aprobado queda elegido en la publicación activa, que no tenía clip, y en la lista de los que falta subir.
    const list = await call('list_clips_to_upload');
    expect(list.data.faltan).toBe(1);
    expect(list.data.clips[0]).toMatchObject({
      codigo: 'MLA1110001',
      titulo: 'Kit 4 Camisas',
      subir_en: 'https://www.mercadolibre.com.ar/publicaciones/listado?search=MLA1110001',
      bajar: expect.stringContaining('https://drive.google.com/uc?export=download&id='),
    });
    // El producto tiene otra publicación activa, de otra medida, con el mismo clip: sigue siendo una sola subida.
    const first = await db.publication.findFirstOrThrow({ where: { externalId: 'MLA1110001' } });
    const second = await db.publication.create({ data: { productId: first.productId, storeId: first.storeId, externalId: 'MLA1110002', title: 'Kit 4 Camisas 0,60', variantKey: '060' } });
    await db.publicationClip.create({ data: { publicationId: second.id, videoId: list.data.clips[0].video } });
    const both = await call('list_clips_to_upload');
    expect(both.data.faltan).toBe(1);
    expect(both.data.clips[0].publicaciones_del_producto).toBe(2);
    expect(both.data.clips[0].va_en).toBe('todas las medidas del producto');
    // Si el clip está solo en una de las dos medidas, es una subida para esa medida sola.
    await db.publicationClip.delete({ where: { publicationId_videoId: { publicationId: second.id, videoId: list.data.clips[0].video } } });
    const one = await call('list_clips_to_upload');
    expect(one.data.clips.map((c: { va_en: string; codigo: string }) => [c.codigo, c.va_en])).toEqual([['MLA1110001', 'solo la medida de esta publicación']]);
    await db.publicationClip.create({ data: { publicationId: second.id, videoId: list.data.clips[0].video } });
    // Subido solo para la medida 060: la otra sigue pendiente.
    await call('mark_clip_uploaded', { publicacion: 'MLA1110002', video: list.data.clips[0].video, solo_esta_medida: true });
    expect((await call('list_clips_to_upload')).data.clips.map((c: { codigo: string }) => c.codigo)).toEqual(['MLA1110001']);
    await call('mark_clip_uploaded', { publicacion: 'MLA1110002', video: list.data.clips[0].video, subido: false, solo_esta_medida: true });
    // Anotarlo como subido lo saca de la lista en las dos; desmarcarlo lo devuelve.
    const marked = await call('mark_clip_uploaded', { publicacion: 'MLA1110001', video: list.data.clips[0].video });
    expect(marked.data).toMatchObject({ subido: true, faltan: 0 });
    expect(await db.publicationClip.count({ where: { uploadedAt: { not: null } } })).toBe(2);
    expect((await call('mark_clip_uploaded', { publicacion: 'MLA1110001', video: list.data.clips[0].video, subido: false })).data.faltan).toBe(1);
    // Claude lo pone en la cola de subida: la app no lo sube, queda el pedido para la extensión de Chrome.
    const queued = await call('queue_clip_uploads', { todos: true });
    expect(queued.data).toMatchObject({ puestos_en_la_cola: 1, en_la_cola: 1, faltan_subir: 1 });
    expect(queued.data.quien_atiende_la_cola).toContain('Ninguna extensión está atendiendo');
    expect((await call('list_clips_to_upload')).data).toMatchObject({ en_la_cola: 1, clips: [expect.objectContaining({ estado: 'en la cola de subida' })] });
    expect((await call('queue_clip_uploads', { clips: [{ publicacion: 'MLA1110001', video: list.data.clips[0].video }], sacar: true })).data).toMatchObject({ sacados_de_la_cola: 1, en_la_cola: 0 });
    expect((await call('queue_clip_uploads', {})).text).toContain('Decí qué clips');
    // Una publicación pausada no entra: Mercado Libre solo acepta clips en las activas.
    await db.publication.updateMany({ data: { channelStatus: 'PAUSED' } });
    expect((await call('list_clips_to_upload')).data.faltan).toBe(0);
    await db.publication.updateMany({ data: { channelStatus: 'ACTIVE' } });

    // Un clip aprobado antes de que existiera la lista entra al abrirla, una sola vez: si se saca, no vuelve.
    await db.publicationClip.deleteMany();
    await db.videoEdit.updateMany({ where: { status: 'APPROVED' }, data: { clipOfferedAt: null } });
    expect((await call('list_clips_to_upload')).data.faltan).toBe(1);
    await db.publicationClip.deleteMany();
    expect((await call('list_clips_to_upload')).data.faltan).toBe(0);

    // Una edición en cola se descarta sin más.
    await call('request_video_edit', { publicacion: 'MLA1110001', video: videoId });
    const discarded = await call('review_video_edit', { publicacion: 'MLA1110001', video: videoId, decision: 'descartar' });
    expect(discarded.data).toMatchObject({ estado: 'edición descartada' });
    expect(await claimNextEdit(db, workerId)).toBeNull();
  });

  it('el guión lleva lo que dice la voz y cómo se lee en el subtítulo, y la cuenta tiene sus reglas de redacción', async () => {
    const saved = await call('save_video_script', { publicacion: 'MLA1110001', frases: ['Para motor uno punto tres.', 'Vienen cuatro.'], en_los_subtitulos: ['Para motor 1.3.', 'Vienen cuatro.'] });
    expect(saved.data.guion_del_clip).toMatchObject({ frases: ['Para motor uno punto tres.', 'Vienen cuatro.'], en_los_subtitulos: ['Para motor 1.3.', 'Vienen cuatro.'] });
    await call('update_video_settings', { reglas_de_redaccion_del_guion: 'Decí kit, no juego.' });
    const step = await call('get_videos_step', { publicacion: 'MLA1110001' });
    expect(step.data.guion_del_clip.en_los_subtitulos).toEqual(['Para motor 1.3.', 'Vienen cuatro.']);
    expect(step.data.como_se_editan_los_videos_de_la_cuenta.reglas_de_redaccion_del_guion).toBe('Decí kit, no juego.');
    // Sin texto aparte, el subtítulo muestra lo que dice la voz.
    expect((await call('save_video_script', { publicacion: 'MLA1110001', frases: ['Vienen cuatro.'] })).data.guion_del_clip).not.toHaveProperty('en_los_subtitulos');
  });

  it('la edición se puede dejar pre-aprobada y con la orden de subir, también cuando ya está en la cola', async () => {
    const asked = await call('request_video_edit', { publicacion: 'MLA1110001', video: videoId, aprobar_al_terminar: true });
    expect(asked.data.edicion).toMatchObject({ estado: 'en cola', pre_aprobada: expect.stringContaining('Se aprueba sola') });
    expect(asked.data.edicion).not.toHaveProperty('se_sube_sola');
    // Ya está en la cola: no se pide de nuevo, pero queda anotada la orden de subir.
    const again = await call('request_video_edit', { publicacion: 'MLA1110001', video: videoId, subir_al_aprobar: true });
    expect(again.data.aviso).toContain('Quedó anotado');
    expect(again.data.edicion).toMatchObject({ pre_aprobada: expect.any(String), se_sube_sola: expect.any(String) });
    expect(await db.videoEdit.count()).toBe(1);
  });

  it('no edita un clip ya editado ni un video que no es del producto', async () => {
    await call('request_video_edit', { publicacion: 'MLA1110001', video: videoId });
    const editId = await macDelivers();
    const clipId = (await db.videoEdit.findUniqueOrThrow({ where: { id: editId } })).clipId!;
    await call('review_video_edit', { publicacion: 'MLA1110001', video: videoId, decision: 'aprobar' });
    const r = await call('request_video_edit', { publicacion: 'MLA1110001', video: clipId });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('ya es un clip editado');
    expect((await call('request_video_edit', { publicacion: 'MLA1110001', video: 'no-existe' })).text).toContain('No hay un video «no-existe»');
    expect((await call('review_video_edit', { publicacion: 'MLA1110001', video: clipId, decision: 'aprobar' })).text).toContain('no tiene ninguna edición');
  });
});
