'use client';
import {useEffect} from 'react';
import {limpiarTodo} from '../lib/workspace/swr.mjs';
/** En /login no hay sesión de nadie: se borra toda lectura guardada por la sesión anterior (otro usuario u otra organización en este navegador). */
export function LimpiarCache(){useEffect(()=>{limpiarTodo();},[]);return null;}
