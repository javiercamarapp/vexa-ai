'use client';
import {useEffect} from 'react';
import {limpiarTodo} from '../lib/workspace/swr.mjs';
import {almacenDelNavegador,limpiarEstadoOnboarding} from '../lib/onboarding/estado';
/** En /login no hay sesión de nadie: se borra toda lectura guardada por la sesión anterior (otro usuario u otra organización en este navegador). */
export function LimpiarCache(){useEffect(()=>{limpiarTodo();limpiarEstadoOnboarding(almacenDelNavegador());},[]);return null;}
