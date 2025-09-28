#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import time
import logging

app = Flask(__name__)
CORS(app)

DATA_DIR = './data'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_json(filename):
    try:
        filepath = os.path.join(DATA_DIR, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f'Fehler beim Laden von {filename}: {e}')
    return []

def save_json(filename, data):
    try:
        filepath = os.path.join(DATA_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logger.error(f'Fehler beim Speichern von {filename}: {e}')
        return False

def get_timestamp_iso():
    return time.strftime('%Y-%m-%dT%H:%M:%S.000Z')

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/api/<module>', methods=['GET', 'POST'])
def module_list(module):
    items = load_json(f'{module}.json')
    
    if request.method == 'GET':
        return jsonify(items)
    
    try:
        if not request.data:
            return jsonify({'error': 'Leerer Request-Body'}), 400
        
        new_item = request.get_json()
        if new_item is None:
            return jsonify({'error': 'Ungültiges JSON'}), 400
        
        existing_ids = [item.get('id', 0) for item in items if isinstance(item.get('id'), int)]
        next_id = 1
        while next_id in existing_ids:
            next_id += 1
        new_item['id'] = next_id
        
        if 'created_at' not in new_item:
            new_item['created_at'] = get_timestamp_iso()
        
        if module == 'tools':
            new_item.setdefault('admin', False)
            new_item.setdefault('autostart', False)
            new_item.setdefault('tags', [])
            new_item.setdefault('favorite', False)
        
        if module == 'faq':
            new_item.setdefault('tags', [])
            new_item.setdefault('favorite', False)
            new_item.setdefault('attachments', [])
        
        items.append(new_item)
        save_json(f'{module}.json', items)
        return jsonify(new_item), 201
    except Exception as e:
        logger.error(f'Fehler beim Erstellen in {module}: {e}')
        return jsonify({'error': f'Fehler beim Erstellen: {str(e)}'}), 500

@app.route('/api/<module>/<int:item_id>', methods=['GET', 'PUT', 'DELETE'])
def module_item(module, item_id):
    items = load_json(f'{module}.json')
    
    idx = next((i for i, it in enumerate(items) if it.get('id') == item_id), None)
    if idx is None:
        return jsonify({'error': 'Nicht gefunden'}), 404
    
    if request.method == 'GET':
        return jsonify(items[idx])
    
    if request.method == 'DELETE':
        items.pop(idx)
        save_json(f'{module}.json', items)
        return jsonify({'success': True})
    
    try:
        if not request.data:
            return jsonify({'error': 'Leerer Request-Body'}), 400
        
        updated_item = request.get_json()
        if updated_item is None:
            return jsonify({'error': 'Ungültiges JSON'}), 400
        
        updated_item['id'] = item_id
        items[idx] = updated_item
        save_json(f'{module}.json', items)
        return jsonify(updated_item)
    except Exception as e:
        logger.error(f'Fehler bei PUT {module}/{item_id}: {e}')
        return jsonify({'error': f'Fehler beim Aktualisieren: {str(e)}'}), 500

@app.route('/api/tools', methods=['GET'])
def get_tools():
    return module_list('tools')

@app.route('/api/tickets', methods=['GET'])
def get_tickets():
    return module_list('tickets')

@app.route('/api/contacts', methods=['GET'])
def get_contacts():
    return module_list('contacts')

@app.route('/api/network', methods=['GET'])
def get_network():
    return module_list('network')

@app.route('/api/faq', methods=['GET'])
def get_faq():
    return module_list('faq')

@app.route('/api/termine', methods=['GET'])
def get_termine():
    return module_list('termine')

@app.route('/api/termine', methods=['POST'])
def add_termin():
    return module_list('termine')

@app.route('/api/telefonbuch/termine', methods=['GET'])
def get_telefonbuch_termine():
    return get_termine()

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint nicht gefunden'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Interner Serverfehler'}), 500

if __name__ == '__main__':
    os.makedirs(DATA_DIR, exist_ok=True)
    print('HelpTool startet auf http://0.0.0.0:5411')
    app.run(host='0.0.0.0', port=5411, debug=False)
